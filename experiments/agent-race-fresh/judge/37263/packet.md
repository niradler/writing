You are reviewing candidate patches for one Django issue. The patches were written by different automated agents; you are not told which. Correctness is measured separately by hidden tests, so do not run anything. Judge code quality only.

## Issue

Admin changelist search crashes (500) on `__exact` search_fields with choices

Regression in 4cecf3039586ea738afafb9a28c946bff42c37c1 (#36865), which replaced `Cast`-based comparison of non-text `__exact` search fields with per-term validation via the model field's `formfield().to_python()`.
That validation is insufficient for two kinds of fields:

**1. Crash (HTTP 500) for fields with choices**

For a model field with `choices` (e.g. `IntegerField(choices=...)`), `formfield()` returns a `TypedChoiceField` whose `to_python()` returns the raw string unvalidated.
The term then reaches the ORM and `IntegerField.get_prep_value()` raises `ValueError: invalid literal for int() with base 10: 'john'`.
Since `ModelAdmin.get_search_results()` is called outside the `IncorrectLookupParameters` handling in `ChangeList.get_queryset()` (`django/contrib/admin/views/main.py`), the error propagates as a server error.

Minimal repro:
{{{#!python
class Client(models.Model):
    name = models.CharField(max_length=30)
    status = models.IntegerField(choices=[(1, "Active"), (2, "Archived")])

class ClientAdmin(admin.ModelAdmin):
    search_fields = ["name", "status__exact"]
}}}
Searching for `john` in the changelist returns HTTP 500 on 6.1 and main; on 6.0 it returned the rows whose name matches.

**2. Over-matching for BooleanField**

For `BooleanField` `__exact` entries, `forms.BooleanField.to_python()` maps almost any string to `True` (only `"false"`/`"0"` map to `False`; nothing raises), so ''any'' search term OR-matches every row with a `True` value.

{{{#!python
class Account(models.Model):
    name = models.CharField(max_length=30)
    active = models.BooleanField(default=True)

class AccountAdmin(admin.ModelAdmin):
    search_fields = ["name", "active__exact"]
}}}
Searching for `john` returns every active account on 6.1 instead of just `john` (6.0 behavior).

## Patch merged upstream (reference only, not the only acceptable design)

```diff
diff --git a/django/contrib/admin/formfields.py b/django/contrib/admin/formfields.py
new file mode 100644
index 0000000000..a60c344ebd
--- /dev/null
+++ b/django/contrib/admin/formfields.py
@@ -0,0 +1,42 @@
+from django.core.exceptions import ValidationError
+from django.forms import NullBooleanField
+
+
+class StrictBooleanField(NullBooleanField):
+    """
+    forms.BooleanField coerces almost any truthy input to True. Delegate to
+    NullBooleanField's stricter parsing while still rejecting None values.
+    """
+
+    def to_python(self, value):
+        # The admin changelist search allows case-insensitivity.
+        try:
+            value = value.lower()
+        except AttributeError:
+            pass
+        value = super().to_python(value)
+        if value is None:
+            # Not translated, as this is currently not user-facing.
+            raise ValidationError("Invalid value.")
+        return value
+
+
+class StrictNullBooleanField(NullBooleanField):
+    """
+    forms.NullBooleanField doesn't distinguish explicit None values, so check
+    for that before delegating.
+    """
+
+    def to_python(self, value):
+        # The admin changelist search allows case-insensitivity.
+        try:
+            value = value.lower()
+        except AttributeError:
+            pass
+        if value in (None, "none"):
+            return None
+        value = super().to_python(value)
+        if value is None:
+            # Not translated, as this is currently not user-facing.
+            raise ValidationError("Invalid value.")
+        return value
diff --git a/django/contrib/admin/options.py b/django/contrib/admin/options.py
index bb8ae23d17..d793619279 100644
--- a/django/contrib/admin/options.py
+++ b/django/contrib/admin/options.py
@@ -16,7 +16,7 @@ from django import forms
 from django.apps import apps
 from django.conf import settings
 from django.contrib import messages
-from django.contrib.admin import helpers, widgets
+from django.contrib.admin import formfields, helpers, widgets
 from django.contrib.admin.checks import (
     BaseModelAdminChecks,
     InlineModelAdminChecks,
@@ -1356,19 +1356,36 @@ class ModelAdmin(BaseModelAdmin):
             for bit in smart_split(search_term):
                 if bit.startswith(('"', "'")) and bit[0] == bit[-1]:
                     bit = unescape_string_literal(bit)
-                # Build term lookups, skipping values invalid for their field.
+                # Build term lookups, skipping values that cannot be converted
+                # to the expected type.
                 bit_lookups = []
                 for orm_lookup, validate_field in orm_lookups:
                     if validate_field is not None:
                         formfield = validate_field.formfield()
                         try:
-                            if formfield is not None:
-                                value = formfield.to_python(bit)
-                            else:
+                            if formfield is None:
                                 # Fields like AutoField lack a form field.
                                 value = validate_field.to_python(bit)
+                            elif isinstance(formfield, forms.NullBooleanField):
+                                # Allow explicit "None" strings.
+                                formfield = formfields.StrictNullBooleanField()
+                                value = formfield.to_python(bit)
+                            elif isinstance(formfield, forms.BooleanField):
+                                # Avoid the coercion of most strings to True.
+                                value = formfields.StrictBooleanField().to_python(bit)
+                            elif isinstance(
+                                formfield,
+                                (
+                                    forms.TypedChoiceField,
+                                    forms.TypedMultipleChoiceField,
+                                ),
+                            ):
+                                # Workaround for issue #34156.
+                                value = formfield.clean(bit)
+                            else:
+                                value = formfield.to_python(bit)
                         except ValidationError:
-                            # Skip this lookup for invalid values.
+                            # Skip this lookup for invalid types.
                             continue
                     else:
                         value = bit
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
diff --git a/django/contrib/admin/options.py b/django/contrib/admin/options.py
index bb8ae23..c09575a 100644
--- a/django/contrib/admin/options.py
+++ b/django/contrib/admin/options.py
@@ -1360,13 +1360,21 @@ class ModelAdmin(BaseModelAdmin):
                 bit_lookups = []
                 for orm_lookup, validate_field in orm_lookups:
                     if validate_field is not None:
-                        formfield = validate_field.formfield()
                         try:
-                            if formfield is not None:
-                                value = formfield.to_python(bit)
+                            if isinstance(validate_field, models.BooleanField):
+                                # Boolean form fields treat arbitrary nonempty
+                                # strings as True. Use the model field's stricter
+                                # parsing, while accepting case-insensitive input.
+                                value = bit.lower()
+                                if value in ("true", "false"):
+                                    value = value.capitalize()
+                                value = validate_field.to_python(value)
                             else:
-                                # Fields like AutoField lack a form field.
-                                value = validate_field.to_python(bit)
+                                formfield = validate_field.formfield()
+                                value = formfield.to_python(bit) if formfield else bit
+                                # Choice form fields don't coerce in to_python().
+                                # Check the converted value against the model field.
+                                value = validate_field.to_python(value)
                         except ValidationError:
                             # Skip this lookup for invalid values.
                             continue
```

## Patch B

```diff
diff --git a/django/contrib/admin/options.py b/django/contrib/admin/options.py
index bb8ae23..b0053f4 100644
--- a/django/contrib/admin/options.py
+++ b/django/contrib/admin/options.py
@@ -1360,13 +1360,27 @@ class ModelAdmin(BaseModelAdmin):
                 bit_lookups = []
                 for orm_lookup, validate_field in orm_lookups:
                     if validate_field is not None:
-                        formfield = validate_field.formfield()
                         try:
-                            if formfield is not None:
-                                value = formfield.to_python(bit)
-                            else:
-                                # Fields like AutoField lack a form field.
+                            if isinstance(validate_field, models.BooleanField):
+                                # Boolean form fields treat arbitrary strings as
+                                # True, which is unsuitable for search terms.
+                                value = validate_field.to_python(
+                                    bit.capitalize()
+                                    if bit.lower() in ("true", "false")
+                                    else bit
+                                )
+                            elif validate_field.choices is not None:
+                                # TypedChoiceField.to_python() doesn't coerce its
+                                # value. Search the stored value, even if it isn't
+                                # among the current choices.
                                 value = validate_field.to_python(bit)
+                            else:
+                                formfield = validate_field.formfield()
+                                if formfield is not None:
+                                    value = formfield.to_python(bit)
+                                else:
+                                    # Fields like AutoField lack a form field.
+                                    value = validate_field.to_python(bit)
                         except ValidationError:
                             # Skip this lookup for invalid values.
                             continue
```

## Patch C

```diff
diff --git a/django/contrib/admin/options.py b/django/contrib/admin/options.py
index bb8ae23..35c99aa 100644
--- a/django/contrib/admin/options.py
+++ b/django/contrib/admin/options.py
@@ -1345,6 +1345,31 @@ class ModelAdmin(BaseModelAdmin):
             # Otherwise, use the field with icontains.
             return "%s__icontains" % field_name, None
 
+        def validate_term(field, term):
+            """
+            Return term converted to a value valid for field, or raise
+            ValidationError if term isn't a valid value for field.
+            """
+            formfield = field.formfield()
+            if formfield is None:
+                # Fields like AutoField lack a form field.
+                return field.to_python(term)
+            if field.choices:
+                # TypedChoiceField.to_python() returns the term unmodified
+                # and unvalidated, relying on validate() (called by clean())
+                # to reject invalid choices and coerce valid ones to the
+                # field's actual type.
+                return formfield.clean(term)
+            if isinstance(formfield, forms.BooleanField):
+                # BooleanField.to_python() coerces nearly any non-empty
+                # string to True, which would make any search term match
+                # every "truthy" row. Only accept unambiguous boolean
+                # representations.
+                if term.lower() not in ("1", "0", "true", "false"):
+                    raise ValidationError("Enter a valid boolean value.")
+                return term.lower() not in ("0", "false")
+            return formfield.to_python(term)
+
         may_have_duplicates = False
         search_fields = self.get_search_fields(request)
         if search_fields and search_term:
@@ -1360,13 +1385,8 @@ class ModelAdmin(BaseModelAdmin):
                 bit_lookups = []
                 for orm_lookup, validate_field in orm_lookups:
                     if validate_field is not None:
-                        formfield = validate_field.formfield()
                         try:
-                            if formfield is not None:
-                                value = formfield.to_python(bit)
-                            else:
-                                # Fields like AutoField lack a form field.
-                                value = validate_field.to_python(bit)
+                            value = validate_term(validate_field, bit)
                         except ValidationError:
                             # Skip this lookup for invalid values.
                             continue
diff --git a/tests/admin_changelist/models.py b/tests/admin_changelist/models.py
index f805c73..41cdbe8 100644
--- a/tests/admin_changelist/models.py
+++ b/tests/admin_changelist/models.py
@@ -150,3 +150,6 @@ class MixedFieldsModel(models.Model):
 
     int_field = models.IntegerField(null=True, blank=True)
     json_field = models.JSONField(null=True, blank=True)
+    status = models.IntegerField(
+        choices=[(1, "Active"), (2, "Archived")], null=True, blank=True
+    )
diff --git a/tests/admin_changelist/tests.py b/tests/admin_changelist/tests.py
index c81d698..7f964cc 100644
--- a/tests/admin_changelist/tests.py
+++ b/tests/admin_changelist/tests.py
@@ -929,6 +929,43 @@ class ChangeListTests(TestCase):
         cl = m.get_changelist_instance(request)
         self.assertCountEqual(cl.queryset, [obj])
 
+    def test_exact_lookup_does_not_overmatch_boolean_field(self):
+        """
+        An exact lookup on a BooleanField doesn't match every "truthy" row
+        for search terms that aren't a recognizable boolean value.
+        """
+        Child.objects.create(name="foo", age=1, is_active=True)
+        Child.objects.create(name="bar", age=2, is_active=True)
+        m = admin.ModelAdmin(Child, custom_site)
+        m.search_fields = ["is_active__exact"]
+
+        request = self.factory.get("/", data={SEARCH_VAR: "foo"})
+        request.user = self.superuser
+
+        cl = m.get_changelist_instance(request)
+        self.assertCountEqual(cl.queryset, [])
+
+    def test_exact_lookup_for_field_with_choices(self):
+        """
+        An exact lookup on a non-string field with choices doesn't crash for
+        search terms that aren't a valid choice and matches rows for terms
+        that are.
+        """
+        active = MixedFieldsModel.objects.create(status=1)
+        MixedFieldsModel.objects.create(status=2)
+        m = admin.ModelAdmin(MixedFieldsModel, custom_site)
+        m.search_fields = ["status__exact"]
+
+        for search_term, expected_result in [
+            ("john", []),
+            ("1", [active]),
+        ]:
+            request = self.factory.get("/", data={SEARCH_VAR: search_term})
+            request.user = self.superuser
+            with self.subTest(search_term=search_term):
+                cl = m.get_changelist_instance(request)
+                self.assertCountEqual(cl.queryset, expected_result)
+
     @skipUnlessDBFeature("supports_primitives_in_json_field")
     def test_exact_lookup_validates_each_field_independently(self):
         """
```

## Patch D

```diff
diff --git a/django/contrib/admin/options.py b/django/contrib/admin/options.py
index bb8ae23..f57c9af 100644
--- a/django/contrib/admin/options.py
+++ b/django/contrib/admin/options.py
@@ -1345,6 +1345,35 @@ class ModelAdmin(BaseModelAdmin):
             # Otherwise, use the field with icontains.
             return "%s__icontains" % field_name, None
 
+        def clean_exact_search_term(field, term):
+            """
+            Validate and convert `term` for a non-text `__exact` lookup on
+            `field`, raising ValidationError if it isn't a valid value.
+            """
+            if isinstance(field, models.BooleanField) and field.choices is None:
+                # BooleanField's form field to_python() coerces any
+                # non-empty string other than "false"/"0" to True (e.g.
+                # "john" -> True), which would make the search term match
+                # every true value. Parse recognized boolean tokens
+                # ourselves instead of deferring to the form field.
+                normalized = term.strip().lower()
+                if normalized in ("1", "t", "true"):
+                    return True
+                if normalized in ("0", "f", "false"):
+                    return False
+                raise ValidationError("Enter a valid boolean value.", code="invalid")
+            formfield = field.formfield()
+            if formfield is None:
+                # Fields like AutoField lack a form field.
+                return field.to_python(term)
+            # Use clean() rather than to_python(): for fields with choices,
+            # the form field is a TypedChoiceField whose to_python() returns
+            # the raw string unvalidated, while clean() also runs the
+            # field's choice validation and coerces the value using the
+            # model field's own to_python() (e.g. converting to int and
+            # raising ValidationError for unparseable values).
+            return formfield.clean(term)
+
         may_have_duplicates = False
         search_fields = self.get_search_fields(request)
         if search_fields and search_term:
@@ -1360,13 +1389,8 @@ class ModelAdmin(BaseModelAdmin):
                 bit_lookups = []
                 for orm_lookup, validate_field in orm_lookups:
                     if validate_field is not None:
-                        formfield = validate_field.formfield()
                         try:
-                            if formfield is not None:
-                                value = formfield.to_python(bit)
-                            else:
-                                # Fields like AutoField lack a form field.
-                                value = validate_field.to_python(bit)
+                            value = clean_exact_search_term(validate_field, bit)
                         except ValidationError:
                             # Skip this lookup for invalid values.
                             continue
diff --git a/tests/admin_changelist/models.py b/tests/admin_changelist/models.py
index f805c73..41cdbe8 100644
--- a/tests/admin_changelist/models.py
+++ b/tests/admin_changelist/models.py
@@ -150,3 +150,6 @@ class MixedFieldsModel(models.Model):
 
     int_field = models.IntegerField(null=True, blank=True)
     json_field = models.JSONField(null=True, blank=True)
+    status = models.IntegerField(
+        choices=[(1, "Active"), (2, "Archived")], null=True, blank=True
+    )
diff --git a/tests/admin_changelist/tests.py b/tests/admin_changelist/tests.py
index c81d698..1e3f33f 100644
--- a/tests/admin_changelist/tests.py
+++ b/tests/admin_changelist/tests.py
@@ -956,6 +956,69 @@ class ChangeListTests(TestCase):
         cl = m.get_changelist_instance(request)
         self.assertCountEqual(cl.queryset, [obj_int])
 
+    def test_exact_lookup_with_choices_field_does_not_crash(self):
+        """
+        An exact lookup on a field with choices must not propagate a
+        ValueError/TypeError from the database layer when the search term
+        isn't a valid value for the underlying field.
+        """
+        obj = MixedFieldsModel.objects.create(int_field=1, status=1)
+        m = admin.ModelAdmin(MixedFieldsModel, custom_site)
+        m.search_fields = ["status__exact"]
+
+        request = self.factory.get("/", data={SEARCH_VAR: "john"})
+        request.user = self.superuser
+        cl = m.get_changelist_instance(request)
+        self.assertCountEqual(cl.queryset, [])
+
+        request = self.factory.get("/", data={SEARCH_VAR: "1"})
+        request.user = self.superuser
+        cl = m.get_changelist_instance(request)
+        self.assertCountEqual(cl.queryset, [obj])
+
+    def test_exact_lookup_boolean_field_does_not_overmatch(self):
+        """
+        An exact lookup on a BooleanField should not match every truthy row
+        for search terms that aren't valid boolean representations.
+        """
+        UnorderedObject.objects.create(bool=True)
+        UnorderedObject.objects.create(bool=True)
+        m = admin.ModelAdmin(UnorderedObject, custom_site)
+        m.search_fields = ["bool__exact"]
+
+        request = self.factory.get("/", data={SEARCH_VAR: "john"})
+        request.user = self.superuser
+        cl = m.get_changelist_instance(request)
+        self.assertCountEqual(cl.queryset, [])
+
+    def test_exact_lookup_boolean_field_recognized_tokens(self):
+        """
+        Exact lookups on a BooleanField recognize common boolean tokens
+        case-insensitively, including "f"/"t" abbreviations, without
+        falling back to the form field's overly lenient bool() coercion.
+        """
+        active = Child.objects.create(name="Active", age=1, is_active=True)
+        inactive = Child.objects.create(name="Inactive", age=2, is_active=False)
+        m = admin.ModelAdmin(Child, custom_site)
+        m.search_fields = ["is_active__exact"]
+
+        for search_term, expected_result in [
+            ("t", [active]),
+            ("T", [active]),
+            ("true", [active]),
+            ("1", [active]),
+            ("f", [inactive]),
+            ("F", [inactive]),
+            ("false", [inactive]),
+            ("0", [inactive]),
+            ("john", []),
+        ]:
+            request = self.factory.get("/", data={SEARCH_VAR: search_term})
+            request.user = self.superuser
+            with self.subTest(search_term=search_term):
+                cl = m.get_changelist_instance(request)
+                self.assertCountEqual(cl.queryset, expected_result)
+
     def test_search_with_exact_lookup_for_non_string_field(self):
         child = Child.objects.create(name="Asher", age=11)
         model_admin = ChildAdmin(Child, custom_site)
```

## Patch E

```diff
diff --git a/django/contrib/admin/options.py b/django/contrib/admin/options.py
index bb8ae23..3d79841 100644
--- a/django/contrib/admin/options.py
+++ b/django/contrib/admin/options.py
@@ -1362,7 +1362,21 @@ class ModelAdmin(BaseModelAdmin):
                     if validate_field is not None:
                         formfield = validate_field.formfield()
                         try:
-                            if formfield is not None:
+                            if isinstance(validate_field, models.BooleanField):
+                                # Boolean form fields treat arbitrary strings as
+                                # True. Accept case-insensitive boolean literals
+                                # without allowing unrelated terms to match.
+                                if bit.lower() in {"true", "false"}:
+                                    value = bit.capitalize()
+                                else:
+                                    value = bit
+                                value = validate_field.to_python(value)
+                            elif isinstance(formfield, forms.TypedChoiceField):
+                                # TypedChoiceField.to_python() doesn't coerce the
+                                # value; its clean() also checks choice membership,
+                                # which isn't appropriate for a database search.
+                                value = validate_field.to_python(bit)
+                            elif formfield is not None:
                                 value = formfield.to_python(bit)
                             else:
                                 # Fields like AutoField lack a form field.
diff --git a/docs/releases/6.1.1.txt b/docs/releases/6.1.1.txt
index 1b7a25b..d12bea0 100644
--- a/docs/releases/6.1.1.txt
+++ b/docs/releases/6.1.1.txt
@@ -9,6 +9,10 @@ Django 6.1.1 fixes several bugs in 6.1.
 Bugfixes
 ========
 
+* Fixed a regression in Django 6.1 where admin searches using ``__exact``
+  lookups on fields with choices could crash, and searches on boolean fields
+  could match unrelated terms.
+
 * Fixed a regression in Django 6.1 where the deprecation of double-dot variable
   lookups incorrectly applied to string and translated template literals
   containing two consecutive dots, such as ``{{ "a..b" }}`` (:ticket:`37257`).
```

## Patch F

```diff
diff --git a/django/contrib/admin/options.py b/django/contrib/admin/options.py
index bb8ae23..f1369d3 100644
--- a/django/contrib/admin/options.py
+++ b/django/contrib/admin/options.py
@@ -1360,13 +1360,20 @@ class ModelAdmin(BaseModelAdmin):
                 bit_lookups = []
                 for orm_lookup, validate_field in orm_lookups:
                     if validate_field is not None:
-                        formfield = validate_field.formfield()
                         try:
-                            if formfield is not None:
-                                value = formfield.to_python(bit)
+                            # Boolean form fields interpret arbitrary strings as
+                            # True, which isn't appropriate for search terms.
+                            if isinstance(validate_field, models.BooleanField):
+                                value = (
+                                    bit.title()
+                                    if bit.lower() in ("true", "false")
+                                    else bit
+                                )
                             else:
-                                # Fields like AutoField lack a form field.
-                                value = validate_field.to_python(bit)
+                                formfield = validate_field.formfield()
+                                value = formfield.to_python(bit) if formfield else bit
+                            # Choice form fields may return an unconverted string.
+                            value = validate_field.to_python(value)
                         except ValidationError:
                             # Skip this lookup for invalid values.
                             continue
```

## Patch G

```diff
diff --git a/django/contrib/admin/options.py b/django/contrib/admin/options.py
index bb8ae23..35594f6 100644
--- a/django/contrib/admin/options.py
+++ b/django/contrib/admin/options.py
@@ -1298,6 +1298,45 @@ class ModelAdmin(BaseModelAdmin):
         """
         return self.search_fields
 
+    # Case-insensitive tokens accepted for an exact lookup against a
+    # BooleanField, matching the tokens django.db.models.BooleanField's own
+    # to_python() accepts (plus case-insensitivity).
+    _BOOLEAN_SEARCH_TERMS = {
+        "1": True,
+        "t": True,
+        "true": True,
+        "0": False,
+        "f": False,
+        "false": False,
+    }
+
+    @classmethod
+    def _get_exact_lookup_value(cls, field, term):
+        """
+        Convert a raw search term to a value suitable for an __exact lookup
+        against a non-text model field, raising ValidationError if the term
+        isn't a valid representation of the field's type.
+        """
+        if isinstance(field, models.BooleanField) and field.choices is None:
+            # forms.BooleanField.to_python() treats almost any non-empty
+            # string as True, so it can't be used to validate the term.
+            try:
+                return cls._BOOLEAN_SEARCH_TERMS[term.lower()]
+            except KeyError:
+                raise ValidationError("Invalid boolean term.")
+        if field.choices is not None:
+            # The form field for a field with choices doesn't validate the
+            # term's type in to_python(), only in validate() (which also
+            # requires the term to be one of the choices). Convert using the
+            # model field directly instead, since that's what the form
+            # field's coercion would delegate to anyway.
+            return field.to_python(term)
+        formfield = field.formfield()
+        if formfield is not None:
+            return formfield.to_python(term)
+        # Fields like AutoField lack a form field.
+        return field.to_python(term)
+
     def get_search_results(self, request, queryset, search_term):
         """
         Return a tuple containing a queryset to implement the search
@@ -1360,13 +1399,8 @@ class ModelAdmin(BaseModelAdmin):
                 bit_lookups = []
                 for orm_lookup, validate_field in orm_lookups:
                     if validate_field is not None:
-                        formfield = validate_field.formfield()
                         try:
-                            if formfield is not None:
-                                value = formfield.to_python(bit)
-                            else:
-                                # Fields like AutoField lack a form field.
-                                value = validate_field.to_python(bit)
+                            value = self._get_exact_lookup_value(validate_field, bit)
                         except ValidationError:
                             # Skip this lookup for invalid values.
                             continue
diff --git a/tests/admin_changelist/models.py b/tests/admin_changelist/models.py
index f805c73..09b0091 100644
--- a/tests/admin_changelist/models.py
+++ b/tests/admin_changelist/models.py
@@ -150,3 +150,13 @@ class MixedFieldsModel(models.Model):
 
     int_field = models.IntegerField(null=True, blank=True)
     json_field = models.JSONField(null=True, blank=True)
+
+
+class ClientStatus(models.IntegerChoices):
+    ACTIVE = 1, "Active"
+    ARCHIVED = 2, "Archived"
+
+
+class Client(models.Model):
+    name = models.CharField(max_length=30)
+    status = models.IntegerField(choices=ClientStatus.choices)
diff --git a/tests/admin_changelist/tests.py b/tests/admin_changelist/tests.py
index c81d698..d91eb7c 100644
--- a/tests/admin_changelist/tests.py
+++ b/tests/admin_changelist/tests.py
@@ -59,6 +59,7 @@ from .models import (
     Child,
     ChordsBand,
     ChordsMusician,
+    Client,
     Concert,
     CustomIdUser,
     Event,
@@ -929,6 +930,46 @@ class ChangeListTests(TestCase):
         cl = m.get_changelist_instance(request)
         self.assertCountEqual(cl.queryset, [obj])
 
+    def test_exact_lookup_does_not_overmatch_boolean(self):
+        """
+        A non-boolean-like search term must not be treated as a match for
+        every True row of a BooleanField __exact search field.
+        """
+        john = UnorderedObject.objects.create(bool=True)
+        UnorderedObject.objects.create(bool=True)
+        m = admin.ModelAdmin(UnorderedObject, custom_site)
+        m.search_fields = ["bool__exact"]
+
+        request = self.factory.get("/", data={SEARCH_VAR: "john"})
+        request.user = self.superuser
+
+        cl = m.get_changelist_instance(request)
+        self.assertCountEqual(cl.queryset, [])
+
+    def test_exact_lookup_with_choices_field(self):
+        """
+        An __exact search field on a field with choices (e.g. IntegerField
+        with choices) must not crash when the search term can't be converted
+        to the field's type, and should match once combined with other
+        search fields that do.
+        """
+        client = Client.objects.create(name="john", status=1)
+        Client.objects.create(name="other", status=2)
+        m = admin.ModelAdmin(Client, custom_site)
+        m.search_fields = ["name", "status__exact"]
+
+        request = self.factory.get("/", data={SEARCH_VAR: "john"})
+        request.user = self.superuser
+
+        cl = m.get_changelist_instance(request)
+        self.assertCountEqual(cl.queryset, [client])
+
+        request = self.factory.get("/", data={SEARCH_VAR: "1"})
+        request.user = self.superuser
+
+        cl = m.get_changelist_instance(request)
+        self.assertCountEqual(cl.queryset, [client])
+
     @skipUnlessDBFeature("supports_primitives_in_json_field")
     def test_exact_lookup_validates_each_field_independently(self):
         """
```

## Patch H

```diff
diff --git a/django/contrib/admin/options.py b/django/contrib/admin/options.py
index bb8ae23..8ea3ede 100644
--- a/django/contrib/admin/options.py
+++ b/django/contrib/admin/options.py
@@ -1360,13 +1360,37 @@ class ModelAdmin(BaseModelAdmin):
                 bit_lookups = []
                 for orm_lookup, validate_field in orm_lookups:
                     if validate_field is not None:
-                        formfield = validate_field.formfield()
                         try:
-                            if formfield is not None:
-                                value = formfield.to_python(bit)
+                            if validate_field.choices:
+                                # ChoiceField/TypedChoiceField's to_python()
+                                # doesn't validate against the choices, so
+                                # use clean() which does and also coerces
+                                # the value to the field's type.
+                                formfield = validate_field.formfield()
+                                if formfield is not None:
+                                    value = formfield.clean(bit)
+                                else:
+                                    value = validate_field.to_python(bit)
+                            elif isinstance(validate_field, models.BooleanField):
+                                # BooleanField's form field treats almost
+                                # any non-empty string as True, which would
+                                # make unrelated search terms match every
+                                # True row. Only accept recognized boolean
+                                # representations.
+                                lowered = bit.lower()
+                                if lowered in ("1", "t", "true"):
+                                    value = True
+                                elif lowered in ("0", "f", "false"):
+                                    value = False
+                                else:
+                                    raise ValidationError("Not a boolean value.")
                             else:
-                                # Fields like AutoField lack a form field.
-                                value = validate_field.to_python(bit)
+                                formfield = validate_field.formfield()
+                                if formfield is not None:
+                                    value = formfield.to_python(bit)
+                                else:
+                                    # Fields like AutoField lack a form field.
+                                    value = validate_field.to_python(bit)
                         except ValidationError:
                             # Skip this lookup for invalid values.
                             continue
```
