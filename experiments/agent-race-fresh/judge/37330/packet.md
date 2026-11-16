You are reviewing candidate patches for one Django issue. The patches were written by different automated agents; you are not told which. Correctness is measured separately by hidden tests, so do not run anything. Judge code quality only.

## Issue

Transform on an annotation alias crashes when output_field is not attached to a model

Applying a transform to an annotation alias raises AttributeError when the
annotation's output_field is not attached to a model:

{{{#!python
Book.objects.annotate(
    published=ExpressionWrapper(F("pubdate"), output_field=DateField())
).values("published__year")
}}}

{{{
AttributeError: 'DateField' object has no attribute 'model'
}}}

Value(..., output_field=DateField()) fails the same way.

The same query works when the annotation's output_field happens to be a model
field, so the outcome depends on how the annotation was spelled rather than on
what it asks for:

|| annotation || .values("a__year") ||
|| annotate(a=F("pubdate")) || works ||
|| annotate(a=ExpressionWrapper(F("pubdate"), output_field=DateField())) || AttributeError ||
|| annotate(a=Value(date(2026, 1, 1), output_field=DateField())) || AttributeError ||

Cause: names_to_path() resolves an annotation name to
self.annotations[name].output_field, which annotate() does not require to be
attached to a model. setup_joins()'s final_transformer() then calls
field.get_col(alias), and Field.get_col() dereferences self.model.

names_to_path() already anticipates this a few lines earlier:

{{{#!python
try:
    model = field.model._meta.concrete_model
except AttributeError:
    # QuerySet.annotate() may introduce fields that aren't attached to a model.
    model = None
}}}

An AttributeError escaping here also bypasses add_fields(), which catches
FieldError to build a helpful message.

Closest precedent found: #34921, same class of failure (an unsuccessful
self.model access on an unbound field, there in DateTimeField.to_python()).
I also searched for "unbound annotation", "output_field model attribute" and
"has no attribute model"; #36787 and #37248 are the nearest hits and neither
covers this path — both are closed/fixed with different symptoms.

Patch: https://github.com/django/django/pull/21914

## Patch merged upstream (reference only, not the only acceptable design)

```diff
diff --git a/django/db/models/sql/query.py b/django/db/models/sql/query.py
index 46337566f5..edc1f7d990 100644
--- a/django/db/models/sql/query.py
+++ b/django/db/models/sql/query.py
@@ -2620,21 +2620,29 @@ class Query(BaseExpression):
                     if extra := self.extra_select.get(f):
                         extra_names.append(f)
                         selected[f] = RawSQL(*extra)
-                    elif f in self.annotation_select:
+                    # Check exact aliases before considering transforms like
+                    # "published__year", since an alias can contain LOOKUP_SEP.
+                    elif (alias := f) in self.annotations or (
+                        (alias := f.split(LOOKUP_SEP, 1)[0]) in self.annotations
+                    ):
+                        if alias not in self.annotation_select:
+                            if self.annotation_select:
+                                raise FieldError(
+                                    f"Cannot select the '{alias}' alias. It was "
+                                    f"excluded by a previous values() or "
+                                    f"values_list() call. Include '{alias}' in "
+                                    f"that call to select it."
+                                )
+                            else:
+                                raise FieldError(
+                                    f"Cannot select the '{alias}' alias. Use "
+                                    f"annotate() to promote it."
+                                )
+                        if f not in self.annotations:
+                            # Resolve transforms.
+                            self.annotations[f] = self.resolve_ref(f)
                         annotation_names.append(f)
                         selected[f] = f
-                    elif f in self.annotations:
-                        if self.annotation_select:
-                            raise FieldError(
-                                f"Cannot select the '{f}' alias. It was excluded "
-                                f"by a previous values() or values_list() call. "
-                                f"Include '{f}' in that call to select it."
-                            )
-                        else:
-                            raise FieldError(
-                                f"Cannot select the '{f}' alias. Use annotate() "
-                                f"to promote it."
-                            )
                     else:
                         # Call `names_to_path` to ensure a FieldError including
                         # annotations about to be masked as valid choices if
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
diff --git a/django/db/models/sql/query.py b/django/db/models/sql/query.py
index 4633756..17fdc53 100644
--- a/django/db/models/sql/query.py
+++ b/django/db/models/sql/query.py
@@ -1940,6 +1940,12 @@ class Query(BaseExpression):
         # fields to the appropriate wrapped version.
 
         def final_transformer(field, alias):
+            # An annotation's output field describes the expression's type; it
+            # isn't necessarily a column (or even attached to a model).
+            if not path and names[0] in self.annotations:
+                annotation = self.annotations[names[0]]
+                if field is annotation.output_field:
+                    return annotation
             if not self.alias_cols:
                 alias = None
             return field.get_col(alias)
```

## Patch B

```diff
diff --git a/django/db/models/sql/query.py b/django/db/models/sql/query.py
index 4633756..640a666 100644
--- a/django/db/models/sql/query.py
+++ b/django/db/models/sql/query.py
@@ -2286,6 +2286,17 @@ class Query(BaseExpression):
         try:
             cols = []
             for name in field_names:
+                # Transforms on annotations must use the expression, not a
+                # column constructed from its potentially unbound output field.
+                annotation, transforms = refs_expression(
+                    name.split(LOOKUP_SEP), self.annotations
+                )
+                if annotation and transforms:
+                    expression = self.annotations[annotation]
+                    for transform in transforms:
+                        expression = self.try_transform(expression, transform)
+                    cols.append(expression)
+                    continue
                 names_to_join = self.get_names_to_join(name)
                 # Join promotion note - we must not remove any rows here, so
                 # if there is no existing joins, use outer join.
```

## Patch C

```diff
diff --git a/django/db/models/fields/__init__.py b/django/db/models/fields/__init__.py
index 18fa2ba..19ef2d5 100644
--- a/django/db/models/fields/__init__.py
+++ b/django/db/models/fields/__init__.py
@@ -573,8 +573,11 @@ class Field(RegisterLookupMixin):
         return []
 
     def get_col(self, alias, output_field=None):
-        if alias == self.model._meta.db_table and (
-            output_field is None or output_field == self
+        model = getattr(self, "model", None)
+        if (
+            model is not None
+            and alias == model._meta.db_table
+            and (output_field is None or output_field == self)
         ):
             return self.cached_col
         from django.db.models.expressions import Col
diff --git a/django/db/models/sql/query.py b/django/db/models/sql/query.py
index 4633756..9312a37 100644
--- a/django/db/models/sql/query.py
+++ b/django/db/models/sql/query.py
@@ -1967,6 +1967,20 @@ class Query(BaseExpression):
                 # resolved into fields.
                 transforms = names[pivot:]
                 break
+        annotation = self.annotations.get(names[0])
+        if (
+            pivot == 1
+            and annotation is not None
+            and final_field is annotation.output_field
+            and getattr(final_field, "model", None) is None
+        ):
+            # The annotation's output_field isn't attached to a model (e.g.
+            # Value() or ExpressionWrapper() with an explicit output_field),
+            # so it can't produce a Col pointing at a real table column. Use
+            # the already resolved annotation expression instead.
+            def final_transformer(field, alias, *, annotation=annotation):
+                return annotation
+
         for name in transforms:
 
             def transform(field, alias, *, name, previous):
```

## Patch D

```diff
diff --git a/django/db/models/sql/query.py b/django/db/models/sql/query.py
index 4633756..2609f45 100644
--- a/django/db/models/sql/query.py
+++ b/django/db/models/sql/query.py
@@ -1940,6 +1940,15 @@ class Query(BaseExpression):
         # fields to the appropriate wrapped version.
 
         def final_transformer(field, alias):
+            if not hasattr(field, "model"):
+                # QuerySet.annotate() may introduce fields that aren't
+                # attached to a model. Such fields don't have a column of
+                # their own to reference, so fall back to the annotation's
+                # expression itself, onto which any transforms are applied
+                # below.
+                annotation = self.annotations.get(names[0])
+                if annotation is not None:
+                    return annotation
             if not self.alias_cols:
                 alias = None
             return field.get_col(alias)
diff --git a/tests/annotations/tests.py b/tests/annotations/tests.py
index 0ad4a0d..dd85e57 100644
--- a/tests/annotations/tests.py
+++ b/tests/annotations/tests.py
@@ -10,6 +10,7 @@ from django.db.models import (
     Case,
     CharField,
     Count,
+    DateField,
     DateTimeField,
     DecimalField,
     Exists,
@@ -610,6 +611,29 @@ class NonAggregateAnnotationTestCase(TestCase):
             [{"published__year": self.b1.pubdate.year}],
         )
 
+    def test_values_transform_on_annotation_unattached_output_field(self):
+        qs = (
+            Book.objects.filter(pk=self.b1.pk)
+            .annotate(
+                published=ExpressionWrapper(F("pubdate"), output_field=DateField())
+            )
+            .values("published__year")
+        )
+        self.assertEqual(
+            list(qs),
+            [{"published__year": self.b1.pubdate.year}],
+        )
+
+        qs = (
+            Book.objects.filter(pk=self.b1.pk)
+            .annotate(published=Value(self.b1.pubdate, output_field=DateField()))
+            .values("published__year")
+        )
+        self.assertEqual(
+            list(qs),
+            [{"published__year": self.b1.pubdate.year}],
+        )
+
     def test_values_fields_annotations_order(self):
         qs = Book.objects.annotate(other_rating=F("rating") - 1).values(
             "other_rating", "rating"
```

## Patch E

```diff
diff --git a/django/db/models/sql/query.py b/django/db/models/sql/query.py
index 4633756..bc085a5 100644
--- a/django/db/models/sql/query.py
+++ b/django/db/models/sql/query.py
@@ -2287,6 +2287,15 @@ class Query(BaseExpression):
             cols = []
             for name in field_names:
                 names_to_join = self.get_names_to_join(name)
+                annotation, transforms = refs_expression(
+                    names_to_join, self.annotations
+                )
+                if annotation:
+                    expression = self.annotations[annotation]
+                    for transform in transforms:
+                        expression = self.try_transform(expression, transform)
+                    cols.append(expression)
+                    continue
                 # Join promotion note - we must not remove any rows here, so
                 # if there is no existing joins, use outer join.
                 join_info = self.setup_joins(
@@ -2639,7 +2648,9 @@ class Query(BaseExpression):
                         # Call `names_to_path` to ensure a FieldError including
                         # annotations about to be masked as valid choices if
                         # `f` is not resolvable.
-                        if self.annotation_select:
+                        if self.annotation_select and not refs_expression(
+                            f.split(LOOKUP_SEP), self.annotations
+                        )[0]:
                             self.names_to_path(f.split(LOOKUP_SEP), self.model._meta)
                         selected[f] = len(field_names)
                         field_names.append(f)
```

## Patch F

```diff
diff --git a/django/db/models/sql/query.py b/django/db/models/sql/query.py
index 4633756..6df3734 100644
--- a/django/db/models/sql/query.py
+++ b/django/db/models/sql/query.py
@@ -2286,6 +2286,10 @@ class Query(BaseExpression):
         try:
             cols = []
             for name in field_names:
+                if name.split(LOOKUP_SEP, 1)[0] in self.annotations:
+                    # Apply transforms to the annotation, not its output field.
+                    cols.append(self.resolve_ref(name))
+                    continue
                 names_to_join = self.get_names_to_join(name)
                 # Join promotion note - we must not remove any rows here, so
                 # if there is no existing joins, use outer join.
```

## Patch G

```diff
diff --git a/django/db/models/sql/query.py b/django/db/models/sql/query.py
index 4633756..051d406 100644
--- a/django/db/models/sql/query.py
+++ b/django/db/models/sql/query.py
@@ -2286,6 +2286,16 @@ class Query(BaseExpression):
         try:
             cols = []
             for name in field_names:
+                if self.annotations:
+                    annotation_name, transform_names = refs_expression(
+                        name.split(LOOKUP_SEP), self.annotations
+                    )
+                    if annotation_name:
+                        expression = self.annotations[annotation_name]
+                        for transform_name in transform_names:
+                            expression = self.try_transform(expression, transform_name)
+                        cols.append(expression)
+                        continue
                 names_to_join = self.get_names_to_join(name)
                 # Join promotion note - we must not remove any rows here, so
                 # if there is no existing joins, use outer join.
diff --git a/tests/annotations/tests.py b/tests/annotations/tests.py
index 0ad4a0d..4c3dcba 100644
--- a/tests/annotations/tests.py
+++ b/tests/annotations/tests.py
@@ -10,6 +10,7 @@ from django.db.models import (
     Case,
     CharField,
     Count,
+    DateField,
     DateTimeField,
     DecimalField,
     Exists,
@@ -610,6 +611,31 @@ class NonAggregateAnnotationTestCase(TestCase):
             [{"published__year": self.b1.pubdate.year}],
         )
 
+    def test_values_transform_on_annotation_with_unattached_output_field(self):
+        qs = (
+            Book.objects.filter(pk=self.b1.pk)
+            .annotate(
+                published=ExpressionWrapper(
+                    F("pubdate"), output_field=DateField()
+                )
+            )
+            .values("published__year")
+        )
+        self.assertEqual(
+            list(qs),
+            [{"published__year": self.b1.pubdate.year}],
+        )
+
+    def test_values_transform_on_value_annotation(self):
+        published = datetime.date(2026, 1, 1)
+        qs = Book.objects.filter(pk=self.b1.pk).annotate(
+            published=Value(published, output_field=DateField())
+        ).values("published__year")
+        self.assertEqual(
+            list(qs),
+            [{"published__year": published.year}],
+        )
+
     def test_values_fields_annotations_order(self):
         qs = Book.objects.annotate(other_rating=F("rating") - 1).values(
             "other_rating", "rating"
```

## Patch H

```diff
diff --git a/django/db/models/sql/query.py b/django/db/models/sql/query.py
index 4633756..3404454 100644
--- a/django/db/models/sql/query.py
+++ b/django/db/models/sql/query.py
@@ -1942,6 +1942,16 @@ class Query(BaseExpression):
         def final_transformer(field, alias):
             if not self.alias_cols:
                 alias = None
+            if not hasattr(field, "model") and not path:
+                # The field comes directly from an annotation that isn't
+                # attached to a model (e.g. Value() or ExpressionWrapper()
+                # with an explicit output_field), so there's no column for
+                # get_col() to dereference. Use the annotation's expression
+                # itself, mirroring resolve_ref()'s handling of transforms
+                # chained onto annotation references.
+                annotation = self.annotations.get(names[pivot - 1])
+                if annotation is not None and annotation.output_field is field:
+                    return annotation
             return field.get_col(alias)
 
         # Try resolving all the names as fields first. If there's an error,
diff --git a/tests/annotations/tests.py b/tests/annotations/tests.py
index 0ad4a0d..eeaf186 100644
--- a/tests/annotations/tests.py
+++ b/tests/annotations/tests.py
@@ -10,6 +10,7 @@ from django.db.models import (
     Case,
     CharField,
     Count,
+    DateField,
     DateTimeField,
     DecimalField,
     Exists,
@@ -610,6 +611,25 @@ class NonAggregateAnnotationTestCase(TestCase):
             [{"published__year": self.b1.pubdate.year}],
         )
 
+    def test_values_transform_on_annotation_with_unattached_output_field(self):
+        # The annotation's output_field doesn't need to be attached to a
+        # model for a transform to be applied to it in values().
+        qs = Book.objects.filter(pk=self.b1.pk).annotate(
+            published=ExpressionWrapper(F("pubdate"), output_field=DateField())
+        )
+        self.assertEqual(
+            list(qs.values("published__year")),
+            [{"published__year": self.b1.pubdate.year}],
+        )
+
+        qs = Book.objects.filter(pk=self.b1.pk).annotate(
+            published=Value(datetime.date(2026, 1, 1), output_field=DateField())
+        )
+        self.assertEqual(
+            list(qs.values("published__year")),
+            [{"published__year": 2026}],
+        )
+
     def test_values_fields_annotations_order(self):
         qs = Book.objects.annotate(other_rating=F("rating") - 1).values(
             "other_rating", "rating"
```
