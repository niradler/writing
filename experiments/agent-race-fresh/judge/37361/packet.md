You are reviewing candidate patches for one Django issue. The patches were written by different automated agents; you are not told which. Correctness is measured separately by hidden tests, so do not run anything. Judge code quality only.

## Issue

Permission renames do not apply to a chain of RenameModel operations

#27489 implemented renaming permissions as part of `RenameModel` migration operations, but did not support a chain of multiple operations.

For a chain of renames A -> B -> C, the database is queried for permissions on A, and then for permissions on B, but because all planned renames are applied to the database in a second loop, the query for permissions on B in the first loop finds nothing, so no second permission rename is done in the second loop.

To reproduce:

1. Define Class A
2. `makemigrations`
3. `migrate` (this creates permissions)
4. Rename A -> B
5. `makemigrations` (answer "Y" to the rename prompt)
6. Rename B -> C
7. `makemigrations` (answer "Y" to the rename prompt)
8. `migrate -v2` (this renames permissions)

Expected: permissions in database end with "C"
Actual:
{{{
Renamed permission(s): myapp.add_a → add_b
Renamed permission(s): myapp.change_a → change_b
Renamed permission(s): myapp.delete_a → delete_b
Renamed permission(s): myapp.view_a → view_b
Adding permission 'Permission object (49)'
Adding permission 'Permission object (50)'
Adding permission 'Permission object (51)'
Adding permission 'Permission object (52)'
}}}

9. `migrate myapp zero`

{{{#!py
RuntimeError: 4 permission rename conflict(s) detected.
}}}

Bug in a040f555069971192220122555f187530d679d53.

## Patch merged upstream (reference only, not the only acceptable design)

```diff
diff --git a/django/contrib/auth/management/__init__.py b/django/contrib/auth/management/__init__.py
index a91fbab396..ed5ccd4bd1 100644
--- a/django/contrib/auth/management/__init__.py
+++ b/django/contrib/auth/management/__init__.py
@@ -141,63 +141,79 @@ def rename_permissions_after_model_rename(
     # django.contrib.auth is NOT installed.
     try:
         Permission = apps.get_model("auth", "Permission")
+        ContentType = apps.get_model("contenttypes", "ContentType")
     except LookupError:
         return
-    if not router.allow_migrate_model(using, Permission):
-        return
-
     db = using or router.db_for_write(Permission)
+    if not router.allow_migrate_model(db, Permission):
+        return
 
     app_label = app_config.label
 
     # Collect (from_model, to_model) pairs
-    renames = [
-        (op.new_name, op.old_name) if backward else (op.old_name, op.new_name)
-        for migration, backward in (plan or [])
-        for op in migration.operations
-        if isinstance(op, migrations.RenameModel)
-        and migration.app_label == app_config.label
-    ]
+    renames = []
+    for migration, backward in plan or []:
+        if migration.app_label != app_label:
+            continue
+        operations = migration.operations
+        if backward:
+            operations = reversed(operations)
+        for op in operations:
+            if not isinstance(op, migrations.RenameModel):
+                continue
+            if backward:
+                renames.append((op.new_name, op.old_name))
+            else:
+                renames.append((op.old_name, op.new_name))
 
     if not renames:
         return
 
-    planned = []
-    conflicts = []
-
+    # Collapse chains of renames (e.g. A -> B -> C) into one rename per model
+    # (A -> C). post_migrate runs after every RenameContentType operation, so
+    # each content type is already stored under the model's final name.
+    original_names = {}
     for old_name, new_name in renames:
-        old_suffix = f"_{old_name.lower()}"
-        new_suffix = f"_{new_name.lower()}"
-
-        actions, verbose_name_raw = _get_permission_metadata(apps, app_label, new_name)
-        perms = Permission.objects.using(db).filter(
-            content_type__app_label=app_label,
-            codename__in=[f"{action}{old_suffix}" for action in actions],
-        )
-
-        for perm in perms:
-            for action in actions:
-                if not perm.codename.startswith(action + "_"):
-                    continue
+        old_name, new_name = old_name.lower(), new_name.lower()
+        original_names[new_name] = original_names.pop(old_name, old_name)
+    # Final model names as written in the migrations, for the permission names.
+    final_names = {new_name.lower(): new_name for _, new_name in renames}
+
+    content_types = (
+        ContentType.objects.using(db)
+        .filter(app_label=app_label, model__in=original_names.keys())
+        .prefetch_related("permission_set")
+    )
+    perms_by_model = {
+        ct.model: {perm.codename: perm for perm in ct.permission_set.all()}
+        for ct in content_types
+    }
 
-                old_codename = perm.codename
-                new_codename = f"{action}{new_suffix}"
-                new_name_str = f"Can {action} {verbose_name_raw}"
+    planned = []
+    conflicts = []
 
-                planned.append((perm, old_codename, new_codename, new_name_str))
+    for new_name, old_name in original_names.items():
+        codenames = perms_by_model.get(new_name)
+        if codenames is None:
+            # Perhaps RenameContentType aborted due to a conflict?
+            continue
 
-    existing = {
-        p.codename
-        for p in Permission.objects.using(db).filter(
-            content_type__app_label=app_label,
-            codename__in=[new for _, _, new, _ in planned],
+        actions, verbose_name_raw = _get_permission_metadata(
+            apps, app_label, final_names[new_name]
         )
-    }
-
-    # Look for conflicts
-    for perm, old, new, _ in planned:
-        if new in existing and perm.codename != new:
-            conflicts.append((perm.pk, old, new))
+        for action in actions:
+            old_codename = f"{action}_{old_name}"
+            new_codename = f"{action}_{new_name}"
+            new_name_str = f"Can {action} {verbose_name_raw}"
+
+            perm = codenames.get(old_codename)
+            if perm is None:
+                continue
+            if codenames.get(new_codename, perm) is not perm:
+                conflicts.append((perm.pk, old_codename, new_codename))
+                continue
+
+            planned.append((perm, old_codename, new_codename, new_name_str))
 
     # Raise error if conflicts found
     if conflicts:
```

## Rubric

Score each patch 1-10 on each criterion:
- design: does the approach fit Django's architecture and solve the problem at the right layer
- robustness: handles the edge cases the issue implies, not only the reported example
- scope: changes only what the issue needs; no unrelated edits, debug leftovers, or dead code
- readability: names, structure, consistency with surrounding code
- tests: quality and coverage of any tests the patch adds (1 if none)

Then give an overall 1-10 and one sentence of justification per patch.

Reply with JSON only: {"<letter>": {"design": n, "robustness": n, "scope": n, "readability": n, "tests": n, "overall": n, "why": "..."}, ...}

## Patch A

```diff
diff --git a/django/contrib/auth/management/__init__.py b/django/contrib/auth/management/__init__.py
index a91fbab..f2c9719 100644
--- a/django/contrib/auth/management/__init__.py
+++ b/django/contrib/auth/management/__init__.py
@@ -150,76 +150,70 @@ def rename_permissions_after_model_rename(
 
     app_label = app_config.label
 
-    # Collect (from_model, to_model) pairs
-    renames = [
-        (op.new_name, op.old_name) if backward else (op.old_name, op.new_name)
-        for migration, backward in (plan or [])
-        for op in migration.operations
-        if isinstance(op, migrations.RenameModel)
-        and migration.app_label == app_config.label
-    ]
+    # Operations within a reversed migration run in reverse order.
+    renames = []
+    for migration, backward in plan or []:
+        if migration.app_label != app_label:
+            continue
+        operations = reversed(migration.operations) if backward else migration.operations
+        for op in operations:
+            if isinstance(op, migrations.RenameModel):
+                renames.append(
+                    (op.new_name, op.old_name) if backward else (op.old_name, op.new_name)
+                )
 
     if not renames:
         return
 
-    planned = []
+    renamed = []
     conflicts = []
-
-    for old_name, new_name in renames:
-        old_suffix = f"_{old_name.lower()}"
-        new_suffix = f"_{new_name.lower()}"
-
-        actions, verbose_name_raw = _get_permission_metadata(apps, app_label, new_name)
-        perms = Permission.objects.using(db).filter(
-            content_type__app_label=app_label,
-            codename__in=[f"{action}{old_suffix}" for action in actions],
-        )
-
-        for perm in perms:
-            for action in actions:
-                if not perm.codename.startswith(action + "_"):
-                    continue
-
-                old_codename = perm.codename
-                new_codename = f"{action}{new_suffix}"
-                new_name_str = f"Can {action} {verbose_name_raw}"
-
-                planned.append((perm, old_codename, new_codename, new_name_str))
-
-    existing = {
-        p.codename
-        for p in Permission.objects.using(db).filter(
-            content_type__app_label=app_label,
-            codename__in=[new for _, _, new, _ in planned],
-        )
-    }
-
-    # Look for conflicts
-    for perm, old, new, _ in planned:
-        if new in existing and perm.codename != new:
-            conflicts.append((perm.pk, old, new))
-
-    # Raise error if conflicts found
-    if conflicts:
-        if verbosity:
-            style = color_style()
-            for pk, old, new in conflicts:
-                msg = (
-                    f"Failed to rename permission {pk} from '{old}' to '{new}'. "
-                    f"Please resolve the conflict manually.\n"
-                )
-                stdout.write(style.WARNING(msg))
-        error_message = f"{len(conflicts)} permission rename conflict(s) detected."
-        raise RuntimeError(error_message)
-
     with transaction.atomic(using=db):
-        for perm, _, new_codename, new_name_str in planned:
-            perm.codename = new_codename
-            perm.name = new_name_str
-            perm.save(update_fields={"codename", "name"}, using=db)
+        for old_name, new_name in renames:
+            old_suffix = f"_{old_name.lower()}"
+            new_suffix = f"_{new_name.lower()}"
+            actions, verbose_name_raw = _get_permission_metadata(
+                apps, app_label, new_name
+            )
+            perms = Permission.objects.using(db).filter(
+                content_type__app_label=app_label,
+                codename__in=[f"{action}{old_suffix}" for action in actions],
+            )
+            existing = set(
+                Permission.objects.using(db)
+                .filter(
+                    content_type__app_label=app_label,
+                    codename__in=[f"{action}{new_suffix}" for action in actions],
+                )
+                .values_list("codename", flat=True)
+            )
+            for perm in perms:
+                for action in actions:
+                    if perm.codename != f"{action}{old_suffix}":
+                        continue
+                    old_codename = perm.codename
+                    new_codename = f"{action}{new_suffix}"
+                    if old_codename != new_codename and new_codename in existing:
+                        conflicts.append((perm.pk, old_codename, new_codename))
+                        break
+                    perm.codename = new_codename
+                    perm.name = f"Can {action} {verbose_name_raw}"
+                    perm.save(update_fields={"codename", "name"}, using=db)
+                    renamed.append((old_codename, new_codename))
+                    break
+
+        if conflicts:
+            if verbosity:
+                style = color_style()
+                for pk, old, new in conflicts:
+                    msg = (
+                        f"Failed to rename permission {pk} from '{old}' to '{new}'. "
+                        f"Please resolve the conflict manually.\n"
+                    )
+                    stdout.write(style.WARNING(msg))
+            raise RuntimeError(f"{len(conflicts)} permission rename conflict(s) detected.")
 
-    for _, from_codename, to_codename, _ in planned:
-        if verbosity >= 2:
+    if verbosity >= 2:
+        for from_codename, to_codename in renamed:
             stdout.write(
                 f"Renamed permission(s): "
                 f"{app_label}.{from_codename} → {to_codename}\n"
```

## Patch B

```diff
diff --git a/django/contrib/auth/management/__init__.py b/django/contrib/auth/management/__init__.py
index a91fbab..9f3f228 100644
--- a/django/contrib/auth/management/__init__.py
+++ b/django/contrib/auth/management/__init__.py
@@ -150,82 +150,87 @@ def rename_permissions_after_model_rename(
 
     app_label = app_config.label
 
-    # Collect (from_model, to_model) pairs
+    # Reverse the operation order when unapplying a migration.
     renames = [
         (op.new_name, op.old_name) if backward else (op.old_name, op.new_name)
         for migration, backward in (plan or [])
-        for op in migration.operations
+        if migration.app_label == app_label
+        for op in (
+            reversed(migration.operations) if backward else migration.operations
+        )
         if isinstance(op, migrations.RenameModel)
-        and migration.app_label == app_config.label
     ]
 
     if not renames:
         return
 
-    planned = []
-    conflicts = []
-
-    for old_name, new_name in renames:
-        old_suffix = f"_{old_name.lower()}"
-        new_suffix = f"_{new_name.lower()}"
-
-        actions, verbose_name_raw = _get_permission_metadata(apps, app_label, new_name)
-        perms = Permission.objects.using(db).filter(
-            content_type__app_label=app_label,
-            codename__in=[f"{action}{old_suffix}" for action in actions],
-        )
-
-        for perm in perms:
-            for action in actions:
-                if not perm.codename.startswith(action + "_"):
-                    continue
-
-                old_codename = perm.codename
-                new_codename = f"{action}{new_suffix}"
-                new_name_str = f"Can {action} {verbose_name_raw}"
-
-                planned.append((perm, old_codename, new_codename, new_name_str))
-
-    existing = {
-        p.codename
-        for p in Permission.objects.using(db).filter(
-            content_type__app_label=app_label,
-            codename__in=[new for _, _, new, _ in planned],
-        )
-    }
-
-    # Look for conflicts
-    for perm, old, new, _ in planned:
-        if new in existing and perm.codename != new:
-            conflicts.append((perm.pk, old, new))
-
-    # Raise error if conflicts found
-    if conflicts:
-        if verbosity:
-            style = color_style()
-            for pk, old, new in conflicts:
-                msg = (
-                    f"Failed to rename permission {pk} from '{old}' to '{new}'. "
-                    f"Please resolve the conflict manually.\n"
+    renamed = []
+    with transaction.atomic(using=db):
+        for old_name, new_name in renames:
+            old_suffix = f"_{old_name.lower()}"
+            new_suffix = f"_{new_name.lower()}"
+            actions, verbose_name_raw = _get_permission_metadata(
+                apps, app_label, new_name
+            )
+            perms = Permission.objects.using(db).filter(
+                content_type__app_label=app_label,
+                codename__in=[f"{action}{old_suffix}" for action in actions],
+            )
+            planned = []
+            for perm in perms:
+                for action in actions:
+                    if perm.codename == f"{action}{old_suffix}":
+                        planned.append(
+                            (
+                                perm,
+                                perm.codename,
+                                f"{action}{new_suffix}",
+                                f"Can {action} {verbose_name_raw}",
+                            )
+                        )
+                        break
+
+            existing = set(
+                Permission.objects.using(db)
+                .filter(
+                    content_type__app_label=app_label,
+                    codename__in=[new for _, _, new, _ in planned],
+                )
+                .values_list("codename", flat=True)
+            )
+            conflicts = [
+                (perm.pk, old, new)
+                for perm, old, new, _ in planned
+                if new in existing and old != new
+            ]
+            if conflicts:
+                if verbosity:
+                    style = color_style()
+                    for pk, old, new in conflicts:
+                        msg = (
+                            f"Failed to rename permission {pk} from '{old}' to '{new}'. "
+                            f"Please resolve the conflict manually.\n"
+                        )
+                        stdout.write(style.WARNING(msg))
+                raise RuntimeError(
+                    f"{len(conflicts)} permission rename conflict(s) detected."
                 )
-                stdout.write(style.WARNING(msg))
-        error_message = f"{len(conflicts)} permission rename conflict(s) detected."
-        raise RuntimeError(error_message)
 
-    with transaction.atomic(using=db):
-        for perm, _, new_codename, new_name_str in planned:
-            perm.codename = new_codename
-            perm.name = new_name_str
-            perm.save(update_fields={"codename", "name"}, using=db)
+            for perm, old_codename, new_codename, new_name_str in planned:
+                perm.codename = new_codename
+                perm.name = new_name_str
+                perm.save(update_fields={"codename", "name"}, using=db)
+                renamed.append((old_codename, new_codename))
 
-    for _, from_codename, to_codename, _ in planned:
-        if verbosity >= 2:
+    if verbosity >= 2:
+        for from_codename, to_codename in renamed:
             stdout.write(
                 f"Renamed permission(s): "
                 f"{app_label}.{from_codename} → {to_codename}\n"
             )
 
 
+
 def get_system_username():
     """
     Return the current system user's username, or an empty string if the
```

## Patch C

```diff
diff --git a/django/contrib/auth/management/__init__.py b/django/contrib/auth/management/__init__.py
index a91fbab..d6927bd 100644
--- a/django/contrib/auth/management/__init__.py
+++ b/django/contrib/auth/management/__init__.py
@@ -162,29 +162,59 @@ def rename_permissions_after_model_rename(
     if not renames:
         return
 
-    planned = []
     conflicts = []
 
+    # Map a permission's pk to its planned rename, so that a chain of
+    # RenameModel operations (A -> B -> C) is collapsed into a single
+    # rename per permission (e.g. add_a -> add_c), since the intermediate
+    # state (add_b) is never written to the database.
+    planned_by_pk = {}
+
     for old_name, new_name in renames:
         old_suffix = f"_{old_name.lower()}"
         new_suffix = f"_{new_name.lower()}"
 
         actions, verbose_name_raw = _get_permission_metadata(apps, app_label, new_name)
-        perms = Permission.objects.using(db).filter(
-            content_type__app_label=app_label,
-            codename__in=[f"{action}{old_suffix}" for action in actions],
+        old_codenames = [f"{action}{old_suffix}" for action in actions]
+
+        # Permissions already renamed earlier in this chain have a pending
+        # codename that doesn't exist in the database yet, so match against
+        # that instead of querying the database again.
+        chained = {
+            pk: entry
+            for pk, entry in planned_by_pk.items()
+            if entry["new_codename"] in old_codenames
+        }
+        perms = [entry["perm"] for entry in chained.values()]
+        perms += list(
+            Permission.objects.using(db)
+            .filter(content_type__app_label=app_label, codename__in=old_codenames)
+            .exclude(pk__in=chained)
         )
 
         for perm in perms:
+            previous = planned_by_pk.get(perm.pk)
+            current_codename = previous["new_codename"] if previous else perm.codename
+            original_codename = previous["old_codename"] if previous else perm.codename
+
             for action in actions:
-                if not perm.codename.startswith(action + "_"):
+                if not current_codename.startswith(action + "_"):
                     continue
 
-                old_codename = perm.codename
                 new_codename = f"{action}{new_suffix}"
                 new_name_str = f"Can {action} {verbose_name_raw}"
 
-                planned.append((perm, old_codename, new_codename, new_name_str))
+                planned_by_pk[perm.pk] = {
+                    "perm": perm,
+                    "old_codename": original_codename,
+                    "new_codename": new_codename,
+                    "new_name": new_name_str,
+                }
+
+    planned = [
+        (entry["perm"], entry["old_codename"], entry["new_codename"], entry["new_name"])
+        for entry in planned_by_pk.values()
+    ]
 
     existing = {
         p.codename
```

## Patch D

```diff
diff --git a/django/contrib/auth/management/__init__.py b/django/contrib/auth/management/__init__.py
index a91fbab..53bbbe4 100644
--- a/django/contrib/auth/management/__init__.py
+++ b/django/contrib/auth/management/__init__.py
@@ -151,7 +151,7 @@ def rename_permissions_after_model_rename(
     app_label = app_config.label
 
     # Collect (from_model, to_model) pairs
-    renames = [
+    raw_renames = [
         (op.new_name, op.old_name) if backward else (op.old_name, op.new_name)
         for migration, backward in (plan or [])
         for op in migration.operations
@@ -159,9 +159,21 @@ def rename_permissions_after_model_rename(
         and migration.app_label == app_config.label
     ]
 
-    if not renames:
+    if not raw_renames:
         return
 
+    # Collapse chains of renames (e.g. A -> B -> C) into a single rename
+    # (A -> C) so permissions are looked up under the name that's actually
+    # still present in the database, rather than an intermediate name that
+    # was never persisted.
+    origin_for_name = {}
+    for old_name, new_name in raw_renames:
+        origin = origin_for_name.pop(old_name, old_name)
+        origin_for_name[new_name] = origin
+    renames = [
+        (origin, new_name) for new_name, origin in origin_for_name.items()
+    ]
+
     planned = []
     conflicts = []
 
diff --git a/tests/auth_tests/test_management.py b/tests/auth_tests/test_management.py
index 6d009e3..a9da856 100644
--- a/tests/auth_tests/test_management.py
+++ b/tests/auth_tests/test_management.py
@@ -1657,6 +1657,60 @@ class PermissionRenameOperationsTests(TransactionTestCase):
             verbosity=0,
         )
 
+    def test_permission_rename_chain(self):
+        """
+        A chain of RenameModel operations (migrated together in a single
+        plan) renames permissions all the way to the final name, not just
+        the first intermediate name.
+        """
+        # Create initial content type and permissions for OldModel.
+        call_command("migrate", "auth_tests", "0001", verbosity=0)
+        # Apply both renames (OldModel -> NewModel -> NewerModel) at once.
+        call_command("migrate", "auth_tests", "0003", verbosity=0)
+
+        actions = ContentType._meta.default_permissions
+
+        for action in actions:
+            self.assertFalse(
+                Permission.objects.filter(codename=f"{action}_oldmodel").exists()
+            )
+            self.assertFalse(
+                Permission.objects.filter(codename=f"{action}_newmodel").exists()
+            )
+            self.assertTrue(
+                Permission.objects.filter(codename=f"{action}_newermodel").exists()
+            )
+
+        # Unapply both renames at once, going straight back to OldModel.
+        call_command(
+            "migrate",
+            "auth_tests",
+            "0001",
+            database="default",
+            interactive=False,
+            verbosity=0,
+        )
+
+        for action in actions:
+            self.assertTrue(
+                Permission.objects.filter(codename=f"{action}_oldmodel").exists()
+            )
+            self.assertFalse(
+                Permission.objects.filter(codename=f"{action}_newmodel").exists()
+            )
+            self.assertFalse(
+                Permission.objects.filter(codename=f"{action}_newermodel").exists()
+            )
+
+        call_command(
+            "migrate",
+            "auth_tests",
+            "zero",
+            database="default",
+            interactive=False,
+            verbosity=0,
+        )
+
     @mock.patch(
         "django.db.router.allow_migrate_model",
         return_value=False,
diff --git a/tests/auth_tests/operations_migrations/0003_rename_newmodel_to_newermodel.py b/tests/auth_tests/operations_migrations/0003_rename_newmodel_to_newermodel.py
new file mode 100644
index 0000000..0090e99
--- /dev/null
+++ b/tests/auth_tests/operations_migrations/0003_rename_newmodel_to_newermodel.py
@@ -0,0 +1,14 @@
+from django.db import migrations
+
+
+class Migration(migrations.Migration):
+    dependencies = [
+        ("auth_tests", "0002_rename_oldmodel_to_newmodel"),
+    ]
+
+    operations = [
+        migrations.RenameModel(
+            old_name="NewModel",
+            new_name="NewerModel",
+        ),
+    ]
```

## Patch E

```diff
diff --git a/django/contrib/auth/management/__init__.py b/django/contrib/auth/management/__init__.py
index a91fbab..fc17385 100644
--- a/django/contrib/auth/management/__init__.py
+++ b/django/contrib/auth/management/__init__.py
@@ -154,7 +154,7 @@ def rename_permissions_after_model_rename(
     renames = [
         (op.new_name, op.old_name) if backward else (op.old_name, op.new_name)
         for migration, backward in (plan or [])
-        for op in migration.operations
+        for op in (reversed(migration.operations) if backward else migration.operations)
         if isinstance(op, migrations.RenameModel)
         and migration.app_label == app_config.label
     ]
@@ -162,63 +162,60 @@ def rename_permissions_after_model_rename(
     if not renames:
         return
 
-    planned = []
-    conflicts = []
-
-    for old_name, new_name in renames:
-        old_suffix = f"_{old_name.lower()}"
-        new_suffix = f"_{new_name.lower()}"
-
-        actions, verbose_name_raw = _get_permission_metadata(apps, app_label, new_name)
-        perms = Permission.objects.using(db).filter(
-            content_type__app_label=app_label,
-            codename__in=[f"{action}{old_suffix}" for action in actions],
-        )
-
-        for perm in perms:
-            for action in actions:
-                if not perm.codename.startswith(action + "_"):
-                    continue
-
-                old_codename = perm.codename
-                new_codename = f"{action}{new_suffix}"
-                new_name_str = f"Can {action} {verbose_name_raw}"
+    renamed = []
+    with transaction.atomic(using=db):
+        for old_name, new_name in renames:
+            old_suffix = f"_{old_name.lower()}"
+            new_suffix = f"_{new_name.lower()}"
 
-                planned.append((perm, old_codename, new_codename, new_name_str))
+            actions, verbose_name_raw = _get_permission_metadata(
+                apps, app_label, new_name
+            )
+            perms = Permission.objects.using(db).filter(
+                content_type__app_label=app_label,
+                codename__in=[f"{action}{old_suffix}" for action in actions],
+            )
 
-    existing = {
-        p.codename
-        for p in Permission.objects.using(db).filter(
-            content_type__app_label=app_label,
-            codename__in=[new for _, _, new, _ in planned],
-        )
-    }
-
-    # Look for conflicts
-    for perm, old, new, _ in planned:
-        if new in existing and perm.codename != new:
-            conflicts.append((perm.pk, old, new))
-
-    # Raise error if conflicts found
-    if conflicts:
-        if verbosity:
-            style = color_style()
-            for pk, old, new in conflicts:
-                msg = (
-                    f"Failed to rename permission {pk} from '{old}' to '{new}'. "
-                    f"Please resolve the conflict manually.\n"
+            planned = []
+            for perm in perms:
+                for action in actions:
+                    if not perm.codename.startswith(action + "_"):
+                        continue
+                    new_codename = f"{action}{new_suffix}"
+                    new_name_str = f"Can {action} {verbose_name_raw}"
+                    planned.append((perm, perm.codename, new_codename, new_name_str))
+
+            existing = {
+                p.codename
+                for p in Permission.objects.using(db).filter(
+                    content_type__app_label=app_label,
+                    codename__in=[new for _, _, new, _ in planned],
                 )
-                stdout.write(style.WARNING(msg))
-        error_message = f"{len(conflicts)} permission rename conflict(s) detected."
-        raise RuntimeError(error_message)
-
-    with transaction.atomic(using=db):
-        for perm, _, new_codename, new_name_str in planned:
-            perm.codename = new_codename
-            perm.name = new_name_str
-            perm.save(update_fields={"codename", "name"}, using=db)
-
-    for _, from_codename, to_codename, _ in planned:
+            }
+            conflicts = [
+                (perm.pk, old, new)
+                for perm, old, new, _ in planned
+                if new in existing and perm.codename != new
+            ]
+            if conflicts:
+                if verbosity:
+                    style = color_style()
+                    for pk, old, new in conflicts:
+                        msg = (
+                            f"Failed to rename permission {pk} from '{old}' to '{new}'. "
+                            f"Please resolve the conflict manually.\n"
+                        )
+                        stdout.write(style.WARNING(msg))
+                error_message = f"{len(conflicts)} permission rename conflict(s) detected."
+                raise RuntimeError(error_message)
+
+            for perm, old_codename, new_codename, new_name_str in planned:
+                perm.codename = new_codename
+                perm.name = new_name_str
+                perm.save(update_fields={"codename", "name"}, using=db)
+                renamed.append((old_codename, new_codename))
+
+    for from_codename, to_codename in renamed:
         if verbosity >= 2:
             stdout.write(
                 f"Renamed permission(s): "
```

## Patch F

```diff
diff --git a/django/contrib/auth/management/__init__.py b/django/contrib/auth/management/__init__.py
index a91fbab..4bd7179 100644
--- a/django/contrib/auth/management/__init__.py
+++ b/django/contrib/auth/management/__init__.py
@@ -154,7 +154,7 @@ def rename_permissions_after_model_rename(
     renames = [
         (op.new_name, op.old_name) if backward else (op.old_name, op.new_name)
         for migration, backward in (plan or [])
-        for op in migration.operations
+        for op in (reversed(migration.operations) if backward else migration.operations)
         if isinstance(op, migrations.RenameModel)
         and migration.app_label == app_config.label
     ]
@@ -163,60 +163,64 @@ def rename_permissions_after_model_rename(
         return
 
     planned = []
-    conflicts = []
-
-    for old_name, new_name in renames:
-        old_suffix = f"_{old_name.lower()}"
-        new_suffix = f"_{new_name.lower()}"
-
-        actions, verbose_name_raw = _get_permission_metadata(apps, app_label, new_name)
-        perms = Permission.objects.using(db).filter(
-            content_type__app_label=app_label,
-            codename__in=[f"{action}{old_suffix}" for action in actions],
-        )
-
-        for perm in perms:
-            for action in actions:
-                if not perm.codename.startswith(action + "_"):
-                    continue
-
-                old_codename = perm.codename
-                new_codename = f"{action}{new_suffix}"
-                new_name_str = f"Can {action} {verbose_name_raw}"
-
-                planned.append((perm, old_codename, new_codename, new_name_str))
-
-    existing = {
-        p.codename
-        for p in Permission.objects.using(db).filter(
-            content_type__app_label=app_label,
-            codename__in=[new for _, _, new, _ in planned],
-        )
-    }
-
-    # Look for conflicts
-    for perm, old, new, _ in planned:
-        if new in existing and perm.codename != new:
-            conflicts.append((perm.pk, old, new))
-
-    # Raise error if conflicts found
-    if conflicts:
-        if verbosity:
-            style = color_style()
-            for pk, old, new in conflicts:
-                msg = (
-                    f"Failed to rename permission {pk} from '{old}' to '{new}'. "
-                    f"Please resolve the conflict manually.\n"
+    with transaction.atomic(using=db):
+        # Apply each step before querying the next so chained renames can find
+        # the permissions renamed by earlier operations.
+        for old_name, new_name in renames:
+            old_suffix = f"_{old_name.lower()}"
+            new_suffix = f"_{new_name.lower()}"
+
+            actions, verbose_name_raw = _get_permission_metadata(
+                apps, app_label, new_name
+            )
+            perms = Permission.objects.using(db).filter(
+                content_type__app_label=app_label,
+                codename__in=[f"{action}{old_suffix}" for action in actions],
+            )
+            step = []
+            for perm in perms:
+                for action in actions:
+                    if perm.codename == f"{action}{old_suffix}":
+                        step.append(
+                            (
+                                perm,
+                                perm.codename,
+                                f"{action}{new_suffix}",
+                                f"Can {action} {verbose_name_raw}",
+                            )
+                        )
+
+            existing = set(
+                Permission.objects.using(db)
+                .filter(
+                    content_type__app_label=app_label,
+                    codename__in=[new for _, _, new, _ in step],
+                )
+                .values_list("codename", flat=True)
+            )
+            conflicts = [
+                (perm.pk, old, new)
+                for perm, old, new, _ in step
+                if new in existing and old != new
+            ]
+            if conflicts:
+                if verbosity:
+                    style = color_style()
+                    for pk, old, new in conflicts:
+                        msg = (
+                            f"Failed to rename permission {pk} from '{old}' to '{new}'. "
+                            f"Please resolve the conflict manually.\n"
+                        )
+                        stdout.write(style.WARNING(msg))
+                raise RuntimeError(
+                    f"{len(conflicts)} permission rename conflict(s) detected."
                 )
-                stdout.write(style.WARNING(msg))
-        error_message = f"{len(conflicts)} permission rename conflict(s) detected."
-        raise RuntimeError(error_message)
 
-    with transaction.atomic(using=db):
-        for perm, _, new_codename, new_name_str in planned:
-            perm.codename = new_codename
-            perm.name = new_name_str
-            perm.save(update_fields={"codename", "name"}, using=db)
+            for perm, _, new_codename, new_name_str in step:
+                perm.codename = new_codename
+                perm.name = new_name_str
+                perm.save(update_fields={"codename", "name"}, using=db)
+            planned.extend(step)
 
     for _, from_codename, to_codename, _ in planned:
         if verbosity >= 2:
```

## Patch G

```diff
diff --git a/django/contrib/auth/management/__init__.py b/django/contrib/auth/management/__init__.py
index a91fbab..967def8 100644
--- a/django/contrib/auth/management/__init__.py
+++ b/django/contrib/auth/management/__init__.py
@@ -162,6 +162,17 @@ def rename_permissions_after_model_rename(
     if not renames:
         return
 
+    # Index existing permissions for this app by codename so that chained
+    # renames (e.g. A -> B -> C) are resolved against the in-memory state as
+    # it's updated, instead of the database, which isn't written to until
+    # all renames have been planned.
+    perms_by_codename = {
+        perm.codename: perm
+        for perm in Permission.objects.using(db).filter(
+            content_type__app_label=app_label,
+        )
+    }
+
     planned = []
     conflicts = []
 
@@ -170,34 +181,27 @@ def rename_permissions_after_model_rename(
         new_suffix = f"_{new_name.lower()}"
 
         actions, verbose_name_raw = _get_permission_metadata(apps, app_label, new_name)
-        perms = Permission.objects.using(db).filter(
-            content_type__app_label=app_label,
-            codename__in=[f"{action}{old_suffix}" for action in actions],
-        )
 
-        for perm in perms:
-            for action in actions:
-                if not perm.codename.startswith(action + "_"):
-                    continue
+        for action in actions:
+            old_codename = f"{action}{old_suffix}"
+            perm = perms_by_codename.get(old_codename)
+            if perm is None:
+                continue
 
-                old_codename = perm.codename
-                new_codename = f"{action}{new_suffix}"
-                new_name_str = f"Can {action} {verbose_name_raw}"
+            new_codename = f"{action}{new_suffix}"
+            new_name_str = f"Can {action} {verbose_name_raw}"
 
-                planned.append((perm, old_codename, new_codename, new_name_str))
+            existing = perms_by_codename.get(new_codename)
+            if existing is not None and existing is not perm:
+                conflicts.append((perm.pk, old_codename, new_codename))
+                continue
 
-    existing = {
-        p.codename
-        for p in Permission.objects.using(db).filter(
-            content_type__app_label=app_label,
-            codename__in=[new for _, _, new, _ in planned],
-        )
-    }
+            del perms_by_codename[old_codename]
+            perm.codename = new_codename
+            perm.name = new_name_str
+            perms_by_codename[new_codename] = perm
 
-    # Look for conflicts
-    for perm, old, new, _ in planned:
-        if new in existing and perm.codename != new:
-            conflicts.append((perm.pk, old, new))
+            planned.append((perm, old_codename, new_codename, new_name_str))
 
     # Raise error if conflicts found
     if conflicts:
@@ -212,10 +216,12 @@ def rename_permissions_after_model_rename(
         error_message = f"{len(conflicts)} permission rename conflict(s) detected."
         raise RuntimeError(error_message)
 
+    # A permission may appear more than once if it went through several
+    # renames in the chain; only its final state needs to be saved.
+    to_save = {perm.pk: perm for perm, _, _, _ in planned}
+
     with transaction.atomic(using=db):
-        for perm, _, new_codename, new_name_str in planned:
-            perm.codename = new_codename
-            perm.name = new_name_str
+        for perm in to_save.values():
             perm.save(update_fields={"codename", "name"}, using=db)
 
     for _, from_codename, to_codename, _ in planned:
diff --git a/tests/auth_tests/test_management.py b/tests/auth_tests/test_management.py
index 6d009e3..164b89c 100644
--- a/tests/auth_tests/test_management.py
+++ b/tests/auth_tests/test_management.py
@@ -1864,6 +1864,61 @@ class PermissionRenameOperationsTests(TransactionTestCase):
             verbosity=0,
         )
 
+    def test_permission_rename_chain(self):
+        """
+        A chain of RenameModel operations (OldModel -> NewModel ->
+        NewerModel) applied together renames permissions all the way to
+        their final codename.
+        """
+        # Create initial content type and permissions for OldModel.
+        call_command("migrate", "auth_tests", "0001", verbosity=0)
+        # Apply both renames in a single migrate call.
+        call_command("migrate", "auth_tests", "0003", verbosity=0)
+
+        actions = ContentType._meta.default_permissions
+
+        for action in actions:
+            self.assertFalse(
+                Permission.objects.filter(codename=f"{action}_oldmodel").exists()
+            )
+            self.assertFalse(
+                Permission.objects.filter(codename=f"{action}_newmodel").exists()
+            )
+            self.assertTrue(
+                Permission.objects.filter(codename=f"{action}_newermodel").exists()
+            )
+
+        # Unapply both migrations in a single migrate call, renaming
+        # NewerModel back to OldModel.
+        call_command(
+            "migrate",
+            "auth_tests",
+            "0001",
+            database="default",
+            interactive=False,
+            verbosity=0,
+        )
+
+        for action in actions:
+            self.assertTrue(
+                Permission.objects.filter(codename=f"{action}_oldmodel").exists()
+            )
+            self.assertFalse(
+                Permission.objects.filter(codename=f"{action}_newmodel").exists()
+            )
+            self.assertFalse(
+                Permission.objects.filter(codename=f"{action}_newermodel").exists()
+            )
+
+        call_command(
+            "migrate",
+            "auth_tests",
+            "zero",
+            database="default",
+            interactive=False,
+            verbosity=0,
+        )
+
 
 class DefaultDBRouter:
     """Route all writes to default."""
diff --git a/tests/auth_tests/operations_migrations/0003_rename_newmodel_to_newermodel.py b/tests/auth_tests/operations_migrations/0003_rename_newmodel_to_newermodel.py
new file mode 100644
index 0000000..0090e99
--- /dev/null
+++ b/tests/auth_tests/operations_migrations/0003_rename_newmodel_to_newermodel.py
@@ -0,0 +1,14 @@
+from django.db import migrations
+
+
+class Migration(migrations.Migration):
+    dependencies = [
+        ("auth_tests", "0002_rename_oldmodel_to_newmodel"),
+    ]
+
+    operations = [
+        migrations.RenameModel(
+            old_name="NewModel",
+            new_name="NewerModel",
+        ),
+    ]
```

## Patch H

```diff
diff --git a/django/contrib/auth/management/__init__.py b/django/contrib/auth/management/__init__.py
index a91fbab..4883497 100644
--- a/django/contrib/auth/management/__init__.py
+++ b/django/contrib/auth/management/__init__.py
@@ -159,6 +159,28 @@ def rename_permissions_after_model_rename(
         and migration.app_label == app_config.label
     ]
 
+    if not renames:
+        return
+
+    # Collapse chains of renames (e.g. A -> B -> C) into their net effect
+    # (A -> C), since the database only ever contains permissions for the
+    # original model name and the intermediate name never gets persisted.
+    origin_for_current = {}
+    order = []
+    for old_name, new_name in renames:
+        origin = origin_for_current.pop(old_name, old_name)
+        if origin not in order:
+            order.append(origin)
+        origin_for_current[new_name] = origin
+    current_for_origin = {
+        origin: current for current, origin in origin_for_current.items()
+    }
+    renames = [
+        (origin, current_for_origin[origin])
+        for origin in order
+        if origin != current_for_origin[origin]
+    ]
+
     if not renames:
         return
 
diff --git a/tests/auth_tests/test_management.py b/tests/auth_tests/test_management.py
index 6d009e3..28e0d67 100644
--- a/tests/auth_tests/test_management.py
+++ b/tests/auth_tests/test_management.py
@@ -1657,6 +1657,56 @@ class PermissionRenameOperationsTests(TransactionTestCase):
             verbosity=0,
         )
 
+    def test_permission_rename_chain(self):
+        # Create initial content type and permissions for OldModel.
+        call_command("migrate", "auth_tests", "0001", verbosity=0)
+        # Apply the migrations that rename OldModel to NewModel and then
+        # NewModel to NewestModel.
+        call_command("migrate", "auth_tests", "0003", verbosity=0)
+
+        actions = ContentType._meta.default_permissions
+
+        for action in actions:
+            self.assertFalse(
+                Permission.objects.filter(codename=f"{action}_oldmodel").exists()
+            )
+            self.assertFalse(
+                Permission.objects.filter(codename=f"{action}_newmodel").exists()
+            )
+            self.assertTrue(
+                Permission.objects.filter(codename=f"{action}_newestmodel").exists()
+            )
+
+        # Unapply both migrations, renaming NewestModel back to OldModel.
+        call_command(
+            "migrate",
+            "auth_tests",
+            "0001",
+            database="default",
+            interactive=False,
+            verbosity=0,
+        )
+
+        for action in actions:
+            self.assertTrue(
+                Permission.objects.filter(codename=f"{action}_oldmodel").exists()
+            )
+            self.assertFalse(
+                Permission.objects.filter(codename=f"{action}_newmodel").exists()
+            )
+            self.assertFalse(
+                Permission.objects.filter(codename=f"{action}_newestmodel").exists()
+            )
+
+        call_command(
+            "migrate",
+            "auth_tests",
+            "zero",
+            database="default",
+            interactive=False,
+            verbosity=0,
+        )
+
     @mock.patch(
         "django.db.router.allow_migrate_model",
         return_value=False,
diff --git a/tests/auth_tests/operations_migrations/0003_rename_newmodel_to_newestmodel.py b/tests/auth_tests/operations_migrations/0003_rename_newmodel_to_newestmodel.py
new file mode 100644
index 0000000..1b67fe6
--- /dev/null
+++ b/tests/auth_tests/operations_migrations/0003_rename_newmodel_to_newestmodel.py
@@ -0,0 +1,14 @@
+from django.db import migrations
+
+
+class Migration(migrations.Migration):
+    dependencies = [
+        ("auth_tests", "0002_rename_oldmodel_to_newmodel"),
+    ]
+
+    operations = [
+        migrations.RenameModel(
+            old_name="NewModel",
+            new_name="NewestModel",
+        ),
+    ]
```
