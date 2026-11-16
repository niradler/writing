You are reviewing candidate patches for one Django issue. The patches were written by different automated agents; you are not told which. Correctness is measured separately by hidden tests, so do not run anything. Judge code quality only.

## Issue

Prefetch objects don't work with slices
Description
	
​Prefetch() objects does not work with sliced querysets. For example the following code results in AssertionError: Cannot filter a query once a slice has been taken.:
Category.objects.prefetch_related(Prefetch(
	'post_set',
	queryset=Post.objects.all()[:3],
	to_attr='example_posts',
))
This behavior is also mentioned in ​this StackOverflow answer. On the other hand it does not seem to be documented in Django Docs.
Why is it needed?
My use case seems to be a common one: I want to display a list of categories while displaying couple of example objects from each category next to it. If I'm not mistaken there isn't currently an efficient way of doing this. Prefetching without slicing would prefetch all objects (and there may be thousands of them) instead of the three examples that are needed.

## Patch merged upstream (reference only, not the only acceptable design)

```diff
diff --git a/django/db/models/fields/related_descriptors.py b/django/db/models/fields/related_descriptors.py
--- a/django/db/models/fields/related_descriptors.py
+++ b/django/db/models/fields/related_descriptors.py
@@ -64,8 +64,10 @@ class Child(Model):
 """
 
 from django.core.exceptions import FieldError
-from django.db import connections, router, transaction
-from django.db.models import Q, signals
+from django.db import DEFAULT_DB_ALIAS, connections, router, transaction
+from django.db.models import Q, Window, signals
+from django.db.models.functions import RowNumber
+from django.db.models.lookups import GreaterThan, LessThanOrEqual
 from django.db.models.query import QuerySet
 from django.db.models.query_utils import DeferredAttribute
 from django.db.models.utils import resolve_callables
@@ -81,6 +83,24 @@ def __set__(self, instance, value):
         instance.__dict__[self.field.attname] = value
 
 
+def _filter_prefetch_queryset(queryset, field_name, instances):
+    predicate = Q(**{f"{field_name}__in": instances})
+    if queryset.query.is_sliced:
+        low_mark, high_mark = queryset.query.low_mark, queryset.query.high_mark
+        order_by = [
+            expr
+            for expr, _ in queryset.query.get_compiler(
+                using=queryset._db or DEFAULT_DB_ALIAS
+            ).get_order_by()
+        ]
+        window = Window(RowNumber(), partition_by=field_name, order_by=order_by)
+        predicate &= GreaterThan(window, low_mark)
+        if high_mark is not None:
+            predicate &= LessThanOrEqual(window, high_mark)
+        queryset.query.clear_limits()
+    return queryset.filter(predicate)
+
+
 class ForwardManyToOneDescriptor:
     """
     Accessor to the related object on the forward side of a many-to-one or
@@ -718,8 +738,7 @@ def get_prefetch_queryset(self, instances, queryset=None):
             rel_obj_attr = self.field.get_local_related_value
             instance_attr = self.field.get_foreign_related_value
             instances_dict = {instance_attr(inst): inst for inst in instances}
-            query = {"%s__in" % self.field.name: instances}
-            queryset = queryset.filter(**query)
+            queryset = _filter_prefetch_queryset(queryset, self.field.name, instances)
 
             # Since we just bypassed this class' get_queryset(), we must manage
             # the reverse relation manually.
@@ -1050,9 +1069,9 @@ def get_prefetch_queryset(self, instances, queryset=None):
 
             queryset._add_hints(instance=instances[0])
             queryset = queryset.using(queryset._db or self._db)
-
-            query = {"%s__in" % self.query_field_name: instances}
-            queryset = queryset._next_is_sticky().filter(**query)
+            queryset = _filter_prefetch_queryset(
+                queryset._next_is_sticky(), self.query_field_name, instances
+            )
 
             # M2M: need to annotate the query in order to get the primary model
             # that the secondary model was actually related to. We know that
```

## Rubric

Score each patch 1-10 on each criterion:
- design: does the approach fit Django's architecture and solve the problem at the right layer
- robustness: edge cases (negative or open-ended slices, step slices, ordering, databases without window functions, to_attr vs cache)
- scope: changes only what the issue needs; no unrelated edits, debug leftovers, or dead code
- readability: names, structure, consistency with surrounding code
- tests: quality and coverage of any tests the patch adds (1 if none)

Then give an overall 1-10 and one sentence of justification per patch.

Reply with JSON only: {"<letter>": {"design": n, "robustness": n, "scope": n, "readability": n, "tests": n, "overall": n, "why": "..."}, ...}

## Patch A

```diff
diff --git a/django/contrib/contenttypes/fields.py b/django/contrib/contenttypes/fields.py
index 5b327b6..3cc1d5f 100644
--- a/django/contrib/contenttypes/fields.py
+++ b/django/contrib/contenttypes/fields.py
@@ -5,17 +5,20 @@ from collections import defaultdict
 from django.contrib.contenttypes.models import ContentType
 from django.core import checks
 from django.core.exceptions import FieldDoesNotExist, ObjectDoesNotExist
-from django.db import DEFAULT_DB_ALIAS, models, router, transaction
-from django.db.models import DO_NOTHING, ForeignObject, ForeignObjectRel
+from django.db import DEFAULT_DB_ALIAS, connections, models, router, transaction
+from django.db.models import DO_NOTHING, ForeignObject, ForeignObjectRel, Window
 from django.db.models.base import ModelBase, make_foreign_order_accessors
 from django.db.models.fields.mixins import FieldCacheMixin
 from django.db.models.fields.related import (
     ReverseManyToOneDescriptor,
     lazy_related_operation,
 )
+from django.db.models.functions import RowNumber
+from django.db.models.lookups import GreaterThan, LessThanOrEqual
 from django.db.models.query_utils import PathInfo
 from django.db.models.sql import AND
 from django.db.models.sql.where import WhereNode
+from django.db.utils import NotSupportedError
 from django.utils.functional import cached_property
 
 
@@ -640,6 +643,33 @@ def create_generic_related_manager(superclass, rel):
                 )
             ]
             query = models.Q.create(content_type_queries, connector=models.Q.OR)
+            db = queryset._db or router.db_for_read(self.model, instance=instances[0])
+            if queryset.query.is_sliced:
+                if not connections[db].features.supports_over_clause:
+                    raise NotSupportedError(
+                        "Prefetching from a limited queryset is only "
+                        "supported on backends that support window "
+                        "functions."
+                    )
+                low_mark, high_mark = queryset.query.low_mark, queryset.query.high_mark
+                order_by = [
+                    expr
+                    for expr, _ in queryset.query.get_compiler(
+                        connection=connections[db]
+                    ).get_order_by()
+                ]
+                window = Window(
+                    RowNumber(),
+                    partition_by=[
+                        self.content_type_field_name,
+                        self.object_id_field_name,
+                    ],
+                    order_by=order_by,
+                )
+                query &= GreaterThan(window, low_mark)
+                if high_mark is not None:
+                    query &= LessThanOrEqual(window, high_mark)
+                queryset.query.clear_limits()
             # We (possibly) need to convert object IDs to the type of the
             # instances' PK in order to match up instances:
             object_id_converter = instances[0]._meta.pk.to_python
diff --git a/django/db/models/fields/related_descriptors.py b/django/db/models/fields/related_descriptors.py
index b192df4..05f21a1 100644
--- a/django/db/models/fields/related_descriptors.py
+++ b/django/db/models/fields/related_descriptors.py
@@ -65,13 +65,40 @@ and two directions (forward and reverse) for a total of six combinations.
 
 from django.core.exceptions import FieldError
 from django.db import connections, router, transaction
-from django.db.models import Q, signals
+from django.db.models import Q, Window, signals
+from django.db.models.functions import RowNumber
+from django.db.models.lookups import GreaterThan, LessThanOrEqual
 from django.db.models.query import QuerySet
 from django.db.models.query_utils import DeferredAttribute
 from django.db.models.utils import resolve_callables
+from django.db.utils import NotSupportedError
 from django.utils.functional import cached_property
 
 
+def _filter_prefetch_queryset(queryset, field_name, instances):
+    predicate = Q(**{"%s__in" % field_name: instances})
+    db = queryset._db or router.db_for_read(queryset.model, instance=instances[0])
+    if queryset.query.is_sliced:
+        if not connections[db].features.supports_over_clause:
+            raise NotSupportedError(
+                "Prefetching from a limited queryset is only supported on "
+                "backends that support window functions."
+            )
+        low_mark, high_mark = queryset.query.low_mark, queryset.query.high_mark
+        order_by = [
+            expr
+            for expr, _ in queryset.query.get_compiler(
+                connection=connections[db]
+            ).get_order_by()
+        ]
+        window = Window(RowNumber(), partition_by=field_name, order_by=order_by)
+        predicate &= GreaterThan(window, low_mark)
+        if high_mark is not None:
+            predicate &= LessThanOrEqual(window, high_mark)
+        queryset.query.clear_limits()
+    return queryset.filter(predicate)
+
+
 class ForeignKeyDeferredAttribute(DeferredAttribute):
     def __set__(self, instance, value):
         if instance.__dict__.get(self.field.attname) != value and self.field.is_cached(
@@ -718,8 +745,7 @@ def create_reverse_many_to_one_manager(superclass, rel):
             rel_obj_attr = self.field.get_local_related_value
             instance_attr = self.field.get_foreign_related_value
             instances_dict = {instance_attr(inst): inst for inst in instances}
-            query = {"%s__in" % self.field.name: instances}
-            queryset = queryset.filter(**query)
+            queryset = _filter_prefetch_queryset(queryset, self.field.name, instances)
 
             # Since we just bypassed this class' get_queryset(), we must manage
             # the reverse relation manually.
@@ -1051,8 +1077,9 @@ def create_forward_many_to_many_manager(superclass, rel, reverse):
             queryset._add_hints(instance=instances[0])
             queryset = queryset.using(queryset._db or self._db)
 
-            query = {"%s__in" % self.query_field_name: instances}
-            queryset = queryset._next_is_sticky().filter(**query)
+            queryset = _filter_prefetch_queryset(
+                queryset._next_is_sticky(), self.query_field_name, instances
+            )
 
             # M2M: need to annotate the query in order to get the primary model
             # that the secondary model was actually related to. We know that
diff --git a/docs/ref/models/querysets.txt b/docs/ref/models/querysets.txt
index 223bb45..9e629e7 100644
--- a/docs/ref/models/querysets.txt
+++ b/docs/ref/models/querysets.txt
@@ -1310,6 +1310,24 @@ less ambiguous than storing a filtered result in the related manager's cache:
     ...     Prefetch('pizzas', queryset=queryset))
     >>> vegetarian_pizzas = restaurants[0].pizzas.all()
 
+The custom ``queryset`` may also be a sliced queryset, in which case the
+slice is applied per parent object rather than across the whole result set.
+For example, to fetch the three most recent pizzas for each restaurant:
+
+    >>> Restaurant.objects.prefetch_related(
+    ...     Prefetch(
+    ...         'pizzas',
+    ...         queryset=Pizza.objects.order_by('-created_at')[:3],
+    ...         to_attr='recent_pizzas',
+    ...     )
+    ... )
+
+Prefetching a sliced queryset issues a single query that uses window
+functions to select the right slice for each parent object, so it requires
+a database backend that supports window functions. Using a sliced queryset
+on a backend without window function support raises a
+:exc:`~django.db.NotSupportedError`.
+
 Custom prefetching also works with single related relations like
 forward ``ForeignKey`` or ``OneToOneField``. Generally you'll want to use
 :meth:`select_related()` for these relations, but there are a number of cases
diff --git a/docs/releases/4.2.txt b/docs/releases/4.2.txt
index ed00ee1..cfa8498 100644
--- a/docs/releases/4.2.txt
+++ b/docs/releases/4.2.txt
@@ -193,6 +193,10 @@ Models
   :ref:`window-functions` with the exception of disjunctive filter lookups
   against window functions when performing aggregation.
 
+* The ``queryset`` argument of :class:`~django.db.models.Prefetch` objects
+  may now be a sliced queryset on database backends that support window
+  functions.
+
 Requests and Responses
 ~~~~~~~~~~~~~~~~~~~~~~
 
diff --git a/tests/prefetch_related/tests.py b/tests/prefetch_related/tests.py
index 1ac17fd..8281042 100644
--- a/tests/prefetch_related/tests.py
+++ b/tests/prefetch_related/tests.py
@@ -2,11 +2,11 @@ from unittest import mock
 
 from django.contrib.contenttypes.models import ContentType
 from django.core.exceptions import ObjectDoesNotExist
-from django.db import connection
+from django.db import NotSupportedError, connection
 from django.db.models import Prefetch, QuerySet, prefetch_related_objects
 from django.db.models.query import get_prefetcher
 from django.db.models.sql import Query
-from django.test import TestCase, override_settings
+from django.test import TestCase, override_settings, skipUnlessDBFeature
 from django.test.utils import CaptureQueriesContext, ignore_warnings
 from django.utils.deprecation import RemovedInDjango50Warning
 
@@ -664,6 +664,53 @@ class CustomPrefetchTests(TestCase):
             )
         self.assertEqual(lst1, lst2)
 
+    @skipUnlessDBFeature("supports_over_clause")
+    def test_reverse_fk_sliced_queryset(self):
+        houses = House.objects.prefetch_related(
+            Prefetch(
+                "rooms",
+                queryset=Room.objects.order_by("name")[:2],
+                to_attr="top_rooms",
+            )
+        )
+        for house in houses:
+            self.assertEqual(
+                [room.name for room in house.top_rooms],
+                ["Dining room", "Kitchen"],
+            )
+
+    @skipUnlessDBFeature("supports_over_clause")
+    def test_m2m_sliced_queryset(self):
+        persons = {
+            person.name: person
+            for person in Person.objects.prefetch_related(
+                Prefetch(
+                    "houses",
+                    queryset=House.objects.order_by("name")[:1],
+                    to_attr="top_houses",
+                )
+            )
+        }
+        self.assertEqual(
+            [house.name for house in persons["Joe"].top_houses], ["House 1"]
+        )
+        self.assertEqual(
+            [house.name for house in persons["Mary"].top_houses], ["House 3"]
+        )
+
+    def test_sliced_queryset_backend_not_supported(self):
+        msg = (
+            "Prefetching from a limited queryset is only supported on "
+            "backends that support window functions."
+        )
+        with mock.patch.object(connection.features, "supports_over_clause", False):
+            with self.assertRaisesMessage(NotSupportedError, msg):
+                list(
+                    House.objects.prefetch_related(
+                        Prefetch("rooms", queryset=Room.objects.all()[:2])
+                    )
+                )
+
     def test_o2m_through_m2m(self):
         # Control lookups.
         with self.assertNumQueries(3):
@@ -1215,6 +1262,22 @@ class GenericRelationTests(TestCase):
         # instance returned by the manager.
         self.assertEqual(list(bookmark.tags.all()), list(bookmark.tags.all().all()))
 
+    @skipUnlessDBFeature("supports_over_clause")
+    def test_custom_queryset_sliced(self):
+        bookmark = Bookmark.objects.create(url="http://www.djangoproject.com/")
+        TaggedItem.objects.create(content_object=bookmark, tag="django")
+        TaggedItem.objects.create(content_object=bookmark, tag="python")
+        TaggedItem.objects.create(content_object=bookmark, tag="redis")
+
+        bookmark = Bookmark.objects.prefetch_related(
+            Prefetch(
+                "tags",
+                queryset=TaggedItem.objects.order_by("tag")[:2],
+                to_attr="top_tags",
+            ),
+        ).get()
+        self.assertEqual([t.tag for t in bookmark.top_tags], ["django", "python"])
+
     def test_deleted_GFK(self):
         TaggedItem.objects.create(tag="awesome", content_object=self.book1)
         TaggedItem.objects.create(tag="awesome", content_object=self.book2)
```

## Patch B

```diff
diff --git a/django/db/models/fields/related_descriptors.py b/django/db/models/fields/related_descriptors.py
index b192df4..59fcacb 100644
--- a/django/db/models/fields/related_descriptors.py
+++ b/django/db/models/fields/related_descriptors.py
@@ -64,14 +64,43 @@ and two directions (forward and reverse) for a total of six combinations.
 """
 
 from django.core.exceptions import FieldError
-from django.db import connections, router, transaction
-from django.db.models import Q, signals
+from django.db import NotSupportedError, connections, router, transaction
+from django.db.models import Q, Window, signals
+from django.db.models.functions import RowNumber
+from django.db.models.lookups import GreaterThan, LessThanOrEqual
 from django.db.models.query import QuerySet
 from django.db.models.query_utils import DeferredAttribute
 from django.db.models.utils import resolve_callables
 from django.utils.functional import cached_property
 
 
+def _filter_prefetch_queryset(queryset, field_name, instances):
+    """
+    Filter the queryset for the instances related to field_name, handling
+    the case where queryset has already been sliced by converting the
+    slice into a per-instance window function restriction.
+    """
+    predicate = Q(**{"%s__in" % field_name: instances})
+    db = queryset.db
+    if queryset.query.is_sliced:
+        if not connections[db].features.supports_over_clause:
+            raise NotSupportedError(
+                "Prefetching a sliced queryset is not supported on backend "
+                "%s." % connections[db].display_name
+            )
+        low_mark, high_mark = queryset.query.low_mark, queryset.query.high_mark
+        order_by = [
+            expr
+            for expr, _ in queryset.query.get_compiler(using=db).get_order_by()
+        ]
+        window = Window(RowNumber(), partition_by=field_name, order_by=order_by)
+        predicate &= GreaterThan(window, low_mark)
+        if high_mark is not None:
+            predicate &= LessThanOrEqual(window, high_mark)
+        queryset.query.clear_limits()
+    return queryset.filter(predicate)
+
+
 class ForeignKeyDeferredAttribute(DeferredAttribute):
     def __set__(self, instance, value):
         if instance.__dict__.get(self.field.attname) != value and self.field.is_cached(
@@ -139,13 +168,12 @@ class ForwardManyToOneDescriptor:
         # The check for len(...) == 1 is a special case that allows the query
         # to be join-less and smaller. Refs #21760.
         if remote_field.is_hidden() or len(self.field.foreign_related_fields) == 1:
-            query = {
-                "%s__in"
-                % related_field.name: {instance_attr(inst)[0] for inst in instances}
-            }
+            field_name = related_field.name
+            filter_values = {instance_attr(inst)[0] for inst in instances}
         else:
-            query = {"%s__in" % self.field.related_query_name(): instances}
-        queryset = queryset.filter(**query)
+            field_name = self.field.related_query_name()
+            filter_values = instances
+        queryset = _filter_prefetch_queryset(queryset, field_name, filter_values)
 
         # Since we're going to assign directly in the cache,
         # we must manage the reverse relation cache manually.
@@ -403,8 +431,9 @@ class ReverseOneToOneDescriptor:
         rel_obj_attr = self.related.field.get_local_related_value
         instance_attr = self.related.field.get_foreign_related_value
         instances_dict = {instance_attr(inst): inst for inst in instances}
-        query = {"%s__in" % self.related.field.name: instances}
-        queryset = queryset.filter(**query)
+        queryset = _filter_prefetch_queryset(
+            queryset, self.related.field.name, instances
+        )
 
         # Since we're going to assign directly in the cache,
         # we must manage the reverse relation cache manually.
@@ -718,8 +747,7 @@ def create_reverse_many_to_one_manager(superclass, rel):
             rel_obj_attr = self.field.get_local_related_value
             instance_attr = self.field.get_foreign_related_value
             instances_dict = {instance_attr(inst): inst for inst in instances}
-            query = {"%s__in" % self.field.name: instances}
-            queryset = queryset.filter(**query)
+            queryset = _filter_prefetch_queryset(queryset, self.field.name, instances)
 
             # Since we just bypassed this class' get_queryset(), we must manage
             # the reverse relation manually.
@@ -1051,8 +1079,9 @@ def create_forward_many_to_many_manager(superclass, rel, reverse):
             queryset._add_hints(instance=instances[0])
             queryset = queryset.using(queryset._db or self._db)
 
-            query = {"%s__in" % self.query_field_name: instances}
-            queryset = queryset._next_is_sticky().filter(**query)
+            queryset = _filter_prefetch_queryset(
+                queryset._next_is_sticky(), self.query_field_name, instances
+            )
 
             # M2M: need to annotate the query in order to get the primary model
             # that the secondary model was actually related to. We know that
diff --git a/docs/ref/models/querysets.txt b/docs/ref/models/querysets.txt
index 223bb45..2789530 100644
--- a/docs/ref/models/querysets.txt
+++ b/docs/ref/models/querysets.txt
@@ -4016,6 +4016,14 @@ attribute:
     >>> Question.objects.prefetch_related(prefetch).get().choice_set.all()
     <QuerySet [<Choice: Not much>, <Choice: The sky>, <Choice: Just hacking again>]>
 
+The ``queryset`` argument also supports sliced querysets. For example, to
+limit the prefetch operation to the first two related objects for each
+instance:
+
+    >>> prefetch = Prefetch('choice_set', queryset=Choice.objects.order_by('id')[:2], to_attr='first_choices')
+    >>> Question.objects.prefetch_related(prefetch).get().first_choices
+    [<Choice: Not much>, <Choice: The sky>]
+
 .. note::
 
     When using ``to_attr`` the prefetched result is stored in a list. This can
diff --git a/docs/releases/4.2.txt b/docs/releases/4.2.txt
index ed00ee1..86cb684 100644
--- a/docs/releases/4.2.txt
+++ b/docs/releases/4.2.txt
@@ -193,6 +193,8 @@ Models
   :ref:`window-functions` with the exception of disjunctive filter lookups
   against window functions when performing aggregation.
 
+* :class:`~django.db.models.Prefetch` objects now allow sliced querysets.
+
 Requests and Responses
 ~~~~~~~~~~~~~~~~~~~~~~
 
diff --git a/tests/prefetch_related/tests.py b/tests/prefetch_related/tests.py
index 1ac17fd..f45f833 100644
--- a/tests/prefetch_related/tests.py
+++ b/tests/prefetch_related/tests.py
@@ -1021,6 +1021,34 @@ class CustomPrefetchTests(TestCase):
             with self.assertNumQueries(0):
                 self.assertEqual(person.cached_all_houses, all_houses)
 
+    def test_reverse_m2o_sliced_queryset(self):
+        houses = House.objects.prefetch_related(
+            Prefetch(
+                "rooms",
+                queryset=Room.objects.order_by("id")[1:3],
+                to_attr="some_rooms",
+            )
+        )
+        for house in houses:
+            self.assertEqual(
+                house.some_rooms,
+                list(Room.objects.filter(house=house).order_by("id")[1:3]),
+            )
+
+    def test_m2m_sliced_queryset(self):
+        persons = Person.objects.prefetch_related(
+            Prefetch(
+                "houses",
+                queryset=House.objects.order_by("id")[:1],
+                to_attr="first_house",
+            )
+        )
+        for person in persons:
+            self.assertEqual(
+                person.first_house,
+                list(House.objects.filter(occupants=person).order_by("id")[:1]),
+            )
+
     def test_filter_deferred(self):
         """
         Related filtering of prefetched querysets is deferred until necessary.
```

## Patch C

```diff
diff --git a/django/db/models/fields/related_descriptors.py b/django/db/models/fields/related_descriptors.py
index b192df4..8311b64 100644
--- a/django/db/models/fields/related_descriptors.py
+++ b/django/db/models/fields/related_descriptors.py
@@ -64,14 +64,40 @@ and two directions (forward and reverse) for a total of six combinations.
 """
 
 from django.core.exceptions import FieldError
-from django.db import connections, router, transaction
-from django.db.models import Q, signals
+from django.db import NotSupportedError, connections, router, transaction
+from django.db.models import Q, Window, signals
+from django.db.models.functions import RowNumber
+from django.db.models.lookups import GreaterThan, LessThanOrEqual
 from django.db.models.query import QuerySet
 from django.db.models.query_utils import DeferredAttribute
 from django.db.models.utils import resolve_callables
 from django.utils.functional import cached_property
 
 
+def _filter_prefetch_queryset(queryset, field_name, instances):
+    """
+    Filter the queryset for the given instances, handling the case where the
+    queryset has been sliced by emulating the offset/limit with a window
+    function partitioned per instance.
+    """
+    predicate = Q(**{"%s__in" % field_name: instances})
+    if queryset.query.is_sliced:
+        if not connections[queryset.db].features.supports_over_clause:
+            raise NotSupportedError(
+                "Prefetching a sliced queryset is not supported on this "
+                "database backend."
+            )
+        low_mark, high_mark = queryset.query.low_mark, queryset.query.high_mark
+        order_by = list(queryset.query.order_by or queryset.model._meta.ordering)
+        window = Window(RowNumber(), partition_by=field_name, order_by=order_by or None)
+        predicate &= GreaterThan(window, low_mark)
+        if high_mark is not None:
+            predicate &= LessThanOrEqual(window, high_mark)
+        queryset = queryset._chain()
+        queryset.query.clear_limits()
+    return queryset.filter(predicate)
+
+
 class ForeignKeyDeferredAttribute(DeferredAttribute):
     def __set__(self, instance, value):
         if instance.__dict__.get(self.field.attname) != value and self.field.is_cached(
@@ -662,8 +688,18 @@ def create_reverse_many_to_one_manager(superclass, rel):
             queryset._add_hints(instance=self.instance)
             if self._db:
                 queryset = queryset.using(self._db)
-            queryset._defer_next_filter = True
-            queryset = queryset.filter(**self.core_filters)
+            if queryset.query.is_sliced:
+                # The queryset's slice must be preserved, but it can't be
+                # filtered once a slice has been taken, so reapply it once
+                # the filter against this instance has been applied.
+                low_mark, high_mark = queryset.query.low_mark, queryset.query.high_mark
+                queryset = queryset._chain()
+                queryset.query.clear_limits()
+                queryset = queryset.filter(**self.core_filters)
+                queryset.query.set_limits(low_mark, high_mark)
+            else:
+                queryset._defer_next_filter = True
+                queryset = queryset.filter(**self.core_filters)
             for field in self.field.foreign_related_fields:
                 val = getattr(self.instance, field.attname)
                 if val is None or (val == "" and empty_strings_as_null):
@@ -718,8 +754,7 @@ def create_reverse_many_to_one_manager(superclass, rel):
             rel_obj_attr = self.field.get_local_related_value
             instance_attr = self.field.get_foreign_related_value
             instances_dict = {instance_attr(inst): inst for inst in instances}
-            query = {"%s__in" % self.field.name: instances}
-            queryset = queryset.filter(**query)
+            queryset = _filter_prefetch_queryset(queryset, self.field.name, instances)
 
             # Since we just bypassed this class' get_queryset(), we must manage
             # the reverse relation manually.
@@ -1028,6 +1063,16 @@ def create_forward_many_to_many_manager(superclass, rel, reverse):
             queryset._add_hints(instance=self.instance)
             if self._db:
                 queryset = queryset.using(self._db)
+            if queryset.query.is_sliced:
+                # The queryset's slice must be preserved, but it can't be
+                # filtered once a slice has been taken, so reapply it once
+                # the filter against this instance has been applied.
+                low_mark, high_mark = queryset.query.low_mark, queryset.query.high_mark
+                queryset = queryset._chain()
+                queryset.query.clear_limits()
+                queryset = queryset._next_is_sticky().filter(**self.core_filters)
+                queryset.query.set_limits(low_mark, high_mark)
+                return queryset
             queryset._defer_next_filter = True
             return queryset._next_is_sticky().filter(**self.core_filters)
 
@@ -1051,8 +1096,10 @@ def create_forward_many_to_many_manager(superclass, rel, reverse):
             queryset._add_hints(instance=instances[0])
             queryset = queryset.using(queryset._db or self._db)
 
-            query = {"%s__in" % self.query_field_name: instances}
-            queryset = queryset._next_is_sticky().filter(**query)
+            queryset._next_is_sticky()
+            queryset = _filter_prefetch_queryset(
+                queryset, self.query_field_name, instances
+            )
 
             # M2M: need to annotate the query in order to get the primary model
             # that the secondary model was actually related to. We know that
diff --git a/docs/ref/models/querysets.txt b/docs/ref/models/querysets.txt
index 223bb45..c38c0e9 100644
--- a/docs/ref/models/querysets.txt
+++ b/docs/ref/models/querysets.txt
@@ -1310,6 +1310,17 @@ less ambiguous than storing a filtered result in the related manager's cache:
     ...     Prefetch('pizzas', queryset=queryset))
     >>> vegetarian_pizzas = restaurants[0].pizzas.all()
 
+You can also prefetch a :ref:`sliced queryset <limiting-querysets>` for
+many-to-many and many-to-one relations, e.g. to retrieve the first few
+related objects per result:
+
+    >>> Restaurant.objects.prefetch_related(
+    ...     Prefetch('pizzas', queryset=Pizza.objects.order_by('-price')[:3],
+    ...              to_attr='top_pizzas'))
+
+This isn't supported if the database doesn't support window functions and
+will raise a :exc:`~django.db.NotSupportedError` in that case.
+
 Custom prefetching also works with single related relations like
 forward ``ForeignKey`` or ``OneToOneField``. Generally you'll want to use
 :meth:`select_related()` for these relations, but there are a number of cases
diff --git a/docs/releases/4.2.txt b/docs/releases/4.2.txt
index ed00ee1..52f6fc7 100644
--- a/docs/releases/4.2.txt
+++ b/docs/releases/4.2.txt
@@ -193,6 +193,10 @@ Models
   :ref:`window-functions` with the exception of disjunctive filter lookups
   against window functions when performing aggregation.
 
+* :class:`~django.db.models.Prefetch` objects now support :ref:`sliced
+  querysets <limiting-querysets>` for many-to-many and many-to-one
+  relations, provided the database supports window functions.
+
 Requests and Responses
 ~~~~~~~~~~~~~~~~~~~~~~
 
diff --git a/tests/prefetch_related/tests.py b/tests/prefetch_related/tests.py
index 1ac17fd..0f39cfe 100644
--- a/tests/prefetch_related/tests.py
+++ b/tests/prefetch_related/tests.py
@@ -2,11 +2,11 @@ from unittest import mock
 
 from django.contrib.contenttypes.models import ContentType
 from django.core.exceptions import ObjectDoesNotExist
-from django.db import connection
+from django.db import NotSupportedError, connection
 from django.db.models import Prefetch, QuerySet, prefetch_related_objects
 from django.db.models.query import get_prefetcher
 from django.db.models.sql import Query
-from django.test import TestCase, override_settings
+from django.test import TestCase, override_settings, skipUnlessDBFeature
 from django.test.utils import CaptureQueriesContext, ignore_warnings
 from django.utils.deprecation import RemovedInDjango50Warning
 
@@ -1040,6 +1040,104 @@ class CustomPrefetchTests(TestCase):
             self.assertEqual(add_q_mock.call_count, 1)
 
 
+@skipUnlessDBFeature("supports_over_clause")
+class PrefetchLimitTests(TestDataMixin, TestCase):
+    def test_reverse_fk(self):
+        # first_time_authors is a reverse foreign key from Book to Author.
+        books = Book.objects.prefetch_related(
+            Prefetch(
+                "first_time_authors", queryset=Author.objects.order_by("pk")[:1]
+            )
+        )
+        self.assertEqual(
+            [list(book.first_time_authors.all()) for book in books],
+            [[self.author1], [], [], [self.author4]],
+        )
+
+    def test_reverse_fk_to_attr(self):
+        books = Book.objects.prefetch_related(
+            Prefetch(
+                "first_time_authors",
+                queryset=Author.objects.order_by("pk")[:1],
+                to_attr="example_authors",
+            )
+        )
+        self.assertEqual(
+            [book.example_authors for book in books],
+            [[self.author1], [], [], [self.author4]],
+        )
+
+    def test_m2m_forward(self):
+        # authors is a many-to-many field from Book to Author.
+        books = Book.objects.prefetch_related(
+            Prefetch("authors", queryset=Author.objects.order_by("pk")[:1])
+        )
+        self.assertEqual(
+            [list(book.authors.all()) for book in books],
+            [[self.author1], [self.author1], [self.author3], [self.author4]],
+        )
+
+    def test_m2m_reverse(self):
+        # books is the reverse accessor of the authors many-to-many field.
+        authors = Author.objects.prefetch_related(
+            Prefetch("books", queryset=Book.objects.order_by("pk")[:1])
+        )
+        self.assertEqual(
+            [list(author.books.all()) for author in authors],
+            [[self.book1], [self.book1], [self.book1], [self.book4]],
+        )
+
+    def test_order_by_changes_limit_per_relation(self):
+        authors = Author.objects.prefetch_related(
+            Prefetch("books", queryset=Book.objects.order_by("-pk")[:1])
+        )
+        self.assertEqual(
+            [list(author.books.all()) for author in authors],
+            [[self.book2], [self.book1], [self.book3], [self.book4]],
+        )
+
+    def test_sliced_offset(self):
+        authors = Author.objects.filter(pk=self.author1.pk).prefetch_related(
+            Prefetch("books", queryset=Book.objects.order_by("pk")[1:2])
+        )
+        self.assertEqual(
+            [list(author.books.all()) for author in authors],
+            [[self.book2]],
+        )
+
+    def test_with_nested_lookup(self):
+        authors = list(
+            Author.objects.prefetch_related(
+                Prefetch("books", queryset=Book.objects.order_by("pk")[:1]),
+                "books__read_by",
+            )
+        )
+        with self.assertNumQueries(0):
+            self.assertEqual(
+                [
+                    [list(book.read_by.all()) for book in author.books.all()]
+                    for author in authors
+                ],
+                [
+                    [[self.reader1]],
+                    [[self.reader1]],
+                    [[self.reader1]],
+                    [[self.reader1, self.reader2]],
+                ],
+            )
+
+    def test_unsupported_backend(self):
+        msg = "Prefetching a sliced queryset is not supported on this database backend."
+        with mock.patch.object(
+            connection.features, "supports_over_clause", False
+        ), self.assertRaisesMessage(NotSupportedError, msg):
+            list(
+                Author.objects.prefetch_related(
+                    Prefetch("books", queryset=Book.objects.order_by("pk")[:1])
+                )
+            )
+
+
 class DefaultManagerTests(TestCase):
     @classmethod
     def setUpTestData(cls):
```

## Patch D

```diff
diff --git a/django/db/models/fields/related_descriptors.py b/django/db/models/fields/related_descriptors.py
index b192df4..9e4baa2 100644
--- a/django/db/models/fields/related_descriptors.py
+++ b/django/db/models/fields/related_descriptors.py
@@ -64,14 +64,37 @@ and two directions (forward and reverse) for a total of six combinations.
 """
 
 from django.core.exceptions import FieldError
-from django.db import connections, router, transaction
-from django.db.models import Q, signals
+from django.db import NotSupportedError, connections, router, transaction
+from django.db.models import Q, Window, signals
+from django.db.models.functions import RowNumber
+from django.db.models.lookups import GreaterThan, LessThanOrEqual
 from django.db.models.query import QuerySet
 from django.db.models.query_utils import DeferredAttribute
 from django.db.models.utils import resolve_callables
 from django.utils.functional import cached_property
 
 
+def _filter_prefetch_queryset(queryset, field_name, instances):
+    predicate = Q(**{f"{field_name}__in": instances})
+    db = queryset.db
+    if queryset.query.is_sliced:
+        if not connections[db].features.supports_over_clause:
+            raise NotSupportedError(
+                "Prefetching from a limited queryset is only supported on backends "
+                "that support window functions."
+            )
+        low_mark, high_mark = queryset.query.low_mark, queryset.query.high_mark
+        order_by = [
+            expr for expr, _ in queryset.query.get_compiler(using=db).get_order_by()
+        ]
+        window = Window(RowNumber(), partition_by=field_name, order_by=order_by)
+        predicate &= GreaterThan(window, low_mark)
+        if high_mark is not None:
+            predicate &= LessThanOrEqual(window, high_mark)
+        queryset.query.clear_limits()
+    return queryset.filter(predicate)
+
+
 class ForeignKeyDeferredAttribute(DeferredAttribute):
     def __set__(self, instance, value):
         if instance.__dict__.get(self.field.attname) != value and self.field.is_cached(
@@ -718,8 +741,7 @@ def create_reverse_many_to_one_manager(superclass, rel):
             rel_obj_attr = self.field.get_local_related_value
             instance_attr = self.field.get_foreign_related_value
             instances_dict = {instance_attr(inst): inst for inst in instances}
-            query = {"%s__in" % self.field.name: instances}
-            queryset = queryset.filter(**query)
+            queryset = _filter_prefetch_queryset(queryset, self.field.name, instances)
 
             # Since we just bypassed this class' get_queryset(), we must manage
             # the reverse relation manually.
@@ -1051,8 +1073,9 @@ def create_forward_many_to_many_manager(superclass, rel, reverse):
             queryset._add_hints(instance=instances[0])
             queryset = queryset.using(queryset._db or self._db)
 
-            query = {"%s__in" % self.query_field_name: instances}
-            queryset = queryset._next_is_sticky().filter(**query)
+            queryset = _filter_prefetch_queryset(
+                queryset._next_is_sticky(), self.query_field_name, instances
+            )
 
             # M2M: need to annotate the query in order to get the primary model
             # that the secondary model was actually related to. We know that
diff --git a/django/db/models/query.py b/django/db/models/query.py
index be0deb9..e8159c5 100644
--- a/django/db/models/query.py
+++ b/django/db/models/query.py
@@ -2520,7 +2520,11 @@ def prefetch_one_level(instances, prefetcher, lookup, level):
             else:
                 manager = getattr(obj, to_attr)
                 if leaf and lookup.queryset is not None:
-                    qs = manager._apply_rel_filters(lookup.queryset)
+                    queryset = lookup.queryset
+                    if queryset.query.is_sliced:
+                        queryset = queryset._chain()
+                        queryset.query.clear_limits()
+                    qs = manager._apply_rel_filters(queryset)
                 else:
                     qs = manager.get_queryset()
                 qs._result_cache = vals
diff --git a/docs/ref/models/querysets.txt b/docs/ref/models/querysets.txt
index 223bb45..89f7ee2 100644
--- a/docs/ref/models/querysets.txt
+++ b/docs/ref/models/querysets.txt
@@ -4007,6 +4007,20 @@ relation, hence reducing the number of queries even further:
     >>> Question.objects.prefetch_related(prefetch).get().choice_set.all()
     <QuerySet [<Choice: The sky>]>
 
+.. versionchanged:: 4.2
+
+    Support for sliced querysets was added for reverse foreign key and
+    many-to-many relations.
+
+For reverse foreign key and many-to-many relations, ``queryset`` may be sliced
+to limit the number of related objects fetched for each instance. For example::
+
+    >>> prefetch = Prefetch('choice_set', queryset=Choice.objects.order_by('pk')[:3], to_attr='first_choices')
+    >>> Question.objects.prefetch_related(prefetch)
+
+This requires a database backend that supports window functions. Backends without
+window function support raise :class:`~django.db.NotSupportedError`.
+
 The ``to_attr`` argument sets the result of the prefetch operation to a custom
 attribute:
 
diff --git a/docs/releases/4.2.txt b/docs/releases/4.2.txt
index ed00ee1..9a55d40 100644
--- a/docs/releases/4.2.txt
+++ b/docs/releases/4.2.txt
@@ -189,6 +189,10 @@ Migrations
 Models
 ~~~~~~
 
+* :class:`~django.db.models.Prefetch` now supports sliced querysets for reverse
+  foreign key and many-to-many relations on databases that support window
+  functions.
+
 * ``QuerySet`` now extensively supports filtering against
   :ref:`window-functions` with the exception of disjunctive filter lookups
   against window functions when performing aggregation.
```

## Patch E

```diff
diff --git a/django/contrib/contenttypes/fields.py b/django/contrib/contenttypes/fields.py
index 5b327b6..0cc9db3 100644
--- a/django/contrib/contenttypes/fields.py
+++ b/django/contrib/contenttypes/fields.py
@@ -5,7 +5,7 @@ from collections import defaultdict
 from django.contrib.contenttypes.models import ContentType
 from django.core import checks
 from django.core.exceptions import FieldDoesNotExist, ObjectDoesNotExist
-from django.db import DEFAULT_DB_ALIAS, models, router, transaction
+from django.db import DEFAULT_DB_ALIAS, connections, models, router, transaction
 from django.db.models import DO_NOTHING, ForeignObject, ForeignObjectRel
 from django.db.models.base import ModelBase, make_foreign_order_accessors
 from django.db.models.fields.mixins import FieldCacheMixin
@@ -13,6 +13,8 @@ from django.db.models.fields.related import (
     ReverseManyToOneDescriptor,
     lazy_related_operation,
 )
+from django.db.models.functions import RowNumber
+from django.db.models.lookups import GreaterThan, LessThanOrEqual
 from django.db.models.query_utils import PathInfo
 from django.db.models.sql import AND
 from django.db.models.sql.where import WhereNode
@@ -644,8 +646,33 @@ def create_generic_related_manager(superclass, rel):
             # instances' PK in order to match up instances:
             object_id_converter = instances[0]._meta.pk.to_python
             content_type_id_field_name = "%s_id" % self.content_type_field_name
+            db = queryset._db or DEFAULT_DB_ALIAS
+            low_mark, high_mark = queryset.query.low_mark, queryset.query.high_mark
+            if (low_mark or high_mark) and connections[
+                db
+            ].features.supports_over_clause:
+                order_by = [
+                    expr
+                    for expr, _ in queryset.query.get_compiler(using=db).get_order_by()
+                ]
+                window = models.Window(
+                    RowNumber(),
+                    partition_by=[
+                        self.content_type_field_name,
+                        self.object_id_field_name,
+                    ],
+                    order_by=order_by,
+                )
+                query &= GreaterThan(window, low_mark)
+                if high_mark is not None:
+                    query &= LessThanOrEqual(window, high_mark)
+                queryset = queryset._chain()
+                queryset.query.add_q(query)
+                queryset.query.clear_limits()
+            else:
+                queryset = queryset.filter(query)
             return (
-                queryset.filter(query),
+                queryset,
                 lambda relobj: (
                     object_id_converter(getattr(relobj, self.object_id_field_name)),
                     getattr(relobj, content_type_id_field_name),
diff --git a/django/db/models/fields/related_descriptors.py b/django/db/models/fields/related_descriptors.py
index b192df4..95eb79b 100644
--- a/django/db/models/fields/related_descriptors.py
+++ b/django/db/models/fields/related_descriptors.py
@@ -64,14 +64,37 @@ and two directions (forward and reverse) for a total of six combinations.
 """
 
 from django.core.exceptions import FieldError
-from django.db import connections, router, transaction
-from django.db.models import Q, signals
+from django.db import DEFAULT_DB_ALIAS, connections, router, transaction
+from django.db.models import Q, Window, signals
+from django.db.models.functions import RowNumber
+from django.db.models.lookups import GreaterThan, LessThanOrEqual
 from django.db.models.query import QuerySet
 from django.db.models.query_utils import DeferredAttribute
 from django.db.models.utils import resolve_callables
 from django.utils.functional import cached_property
 
 
+def _filter_prefetch_queryset(queryset, field_name, instances):
+    predicate = Q(**{"%s__in" % field_name: instances})
+    db = queryset._db or DEFAULT_DB_ALIAS
+    if not connections[db].features.supports_over_clause:
+        return queryset.filter(predicate)
+    low_mark, high_mark = queryset.query.low_mark, queryset.query.high_mark
+    if not (low_mark or high_mark):
+        return queryset.filter(predicate)
+    order_by = [
+        expr for expr, _ in queryset.query.get_compiler(using=db).get_order_by()
+    ]
+    window = Window(RowNumber(), partition_by=field_name, order_by=order_by)
+    predicate &= GreaterThan(window, low_mark)
+    if high_mark is not None:
+        predicate &= LessThanOrEqual(window, high_mark)
+    queryset = queryset._chain()
+    queryset.query.add_q(predicate)
+    queryset.query.clear_limits()
+    return queryset
+
+
 class ForeignKeyDeferredAttribute(DeferredAttribute):
     def __set__(self, instance, value):
         if instance.__dict__.get(self.field.attname) != value and self.field.is_cached(
@@ -718,8 +741,7 @@ def create_reverse_many_to_one_manager(superclass, rel):
             rel_obj_attr = self.field.get_local_related_value
             instance_attr = self.field.get_foreign_related_value
             instances_dict = {instance_attr(inst): inst for inst in instances}
-            query = {"%s__in" % self.field.name: instances}
-            queryset = queryset.filter(**query)
+            queryset = _filter_prefetch_queryset(queryset, self.field.name, instances)
 
             # Since we just bypassed this class' get_queryset(), we must manage
             # the reverse relation manually.
@@ -1051,8 +1073,9 @@ def create_forward_many_to_many_manager(superclass, rel, reverse):
             queryset._add_hints(instance=instances[0])
             queryset = queryset.using(queryset._db or self._db)
 
-            query = {"%s__in" % self.query_field_name: instances}
-            queryset = queryset._next_is_sticky().filter(**query)
+            queryset = _filter_prefetch_queryset(
+                queryset._next_is_sticky(), self.query_field_name, instances
+            )
 
             # M2M: need to annotate the query in order to get the primary model
             # that the secondary model was actually related to. We know that
```

## Patch F

```diff
```

## Patch G

```diff
diff --git a/django/db/models/fields/related_descriptors.py b/django/db/models/fields/related_descriptors.py
index b192df4..62d9a8e 100644
--- a/django/db/models/fields/related_descriptors.py
+++ b/django/db/models/fields/related_descriptors.py
@@ -64,14 +64,37 @@ and two directions (forward and reverse) for a total of six combinations.
 """
 
 from django.core.exceptions import FieldError
-from django.db import connections, router, transaction
-from django.db.models import Q, signals
+from django.db import NotSupportedError, connections, router, transaction
+from django.db.models import Q, Window, signals
+from django.db.models.functions import RowNumber
+from django.db.models.lookups import GreaterThan, LessThanOrEqual
 from django.db.models.query import QuerySet
 from django.db.models.query_utils import DeferredAttribute
 from django.db.models.utils import resolve_callables
 from django.utils.functional import cached_property
 
 
+def _filter_prefetch_queryset(queryset, field_name, instances):
+    predicate = Q(**{f"{field_name}__in": instances})
+    if queryset.query.is_sliced:
+        db = queryset._db or router.db_for_read(queryset.model, **queryset._hints)
+        if not connections[db].features.supports_over_clause:
+            raise NotSupportedError(
+                "Prefetching from a limited queryset is only supported on backends "
+                "that support window functions."
+            )
+        low_mark, high_mark = queryset.query.low_mark, queryset.query.high_mark
+        order_by = [
+            expr for expr, _ in queryset.query.get_compiler(using=db).get_order_by()
+        ]
+        window = Window(RowNumber(), partition_by=field_name, order_by=order_by)
+        predicate &= GreaterThan(window, low_mark)
+        if high_mark is not None:
+            predicate &= LessThanOrEqual(window, high_mark)
+        queryset.query.clear_limits()
+    return queryset.filter(predicate)
+
+
 class ForeignKeyDeferredAttribute(DeferredAttribute):
     def __set__(self, instance, value):
         if instance.__dict__.get(self.field.attname) != value and self.field.is_cached(
@@ -718,8 +741,7 @@ def create_reverse_many_to_one_manager(superclass, rel):
             rel_obj_attr = self.field.get_local_related_value
             instance_attr = self.field.get_foreign_related_value
             instances_dict = {instance_attr(inst): inst for inst in instances}
-            query = {"%s__in" % self.field.name: instances}
-            queryset = queryset.filter(**query)
+            queryset = _filter_prefetch_queryset(queryset, self.field.name, instances)
 
             # Since we just bypassed this class' get_queryset(), we must manage
             # the reverse relation manually.
@@ -1051,8 +1073,9 @@ def create_forward_many_to_many_manager(superclass, rel, reverse):
             queryset._add_hints(instance=instances[0])
             queryset = queryset.using(queryset._db or self._db)
 
-            query = {"%s__in" % self.query_field_name: instances}
-            queryset = queryset._next_is_sticky().filter(**query)
+            queryset = _filter_prefetch_queryset(
+                queryset._next_is_sticky(), self.query_field_name, instances
+            )
 
             # M2M: need to annotate the query in order to get the primary model
             # that the secondary model was actually related to. We know that
diff --git a/django/db/models/query.py b/django/db/models/query.py
index be0deb9..5bbbd95 100644
--- a/django/db/models/query.py
+++ b/django/db/models/query.py
@@ -2520,7 +2520,19 @@ def prefetch_one_level(instances, prefetcher, lookup, level):
             else:
                 manager = getattr(obj, to_attr)
                 if leaf and lookup.queryset is not None:
-                    qs = manager._apply_rel_filters(lookup.queryset)
+                    if lookup.queryset.query.is_sliced:
+                        # Apply relation filters before restoring the slice on the
+                        # cached queryset. The fetched values are already limited
+                        # per instance by the prefetch query.
+                        queryset = lookup.queryset._chain()
+                        low_mark, high_mark = (
+                            queryset.query.low_mark, queryset.query.high_mark
+                        )
+                        queryset.query.clear_limits()
+                        qs = manager._apply_rel_filters(queryset)
+                        qs.query.set_limits(low_mark, high_mark)
+                    else:
+                        qs = manager._apply_rel_filters(lookup.queryset)
                 else:
                     qs = manager.get_queryset()
                 qs._result_cache = vals
diff --git a/docs/ref/models/querysets.txt b/docs/ref/models/querysets.txt
index 223bb45..73fcaa3 100644
--- a/docs/ref/models/querysets.txt
+++ b/docs/ref/models/querysets.txt
@@ -1276,6 +1276,17 @@ applicable to reduce the number of queries even further:
     >>> Pizza.objects.prefetch_related(
     ...     Prefetch('restaurants', queryset=Restaurant.objects.select_related('best_pizza')))
 
+For a reverse foreign key or many-to-many relation, a sliced queryset can limit
+the number of related objects fetched for each instance. This requires a database that supports window functions::
+
+    >>> Restaurant.objects.prefetch_related(
+    ...     Prefetch('pizzas', queryset=Pizza.objects.order_by('name')[:3],
+    ...              to_attr='first_pizzas'))
+
+.. versionchanged:: 4.2
+
+    Support for sliced querysets was added.
+
 You can also assign the prefetched result to a custom attribute with the optional
 ``to_attr`` argument. The result will be stored directly in a list.
 
diff --git a/docs/releases/4.2.txt b/docs/releases/4.2.txt
index ed00ee1..7c2a88b 100644
--- a/docs/releases/4.2.txt
+++ b/docs/releases/4.2.txt
@@ -189,6 +189,9 @@ Migrations
 Models
 ~~~~~~
 
+* :class:`~django.db.models.Prefetch` now supports sliced querysets for reverse
+  foreign key and many-to-many relations on databases with window functions.
+
 * ``QuerySet`` now extensively supports filtering against
   :ref:`window-functions` with the exception of disjunctive filter lookups
   against window functions when performing aggregation.
```

## Patch H

```diff
diff --git a/django/contrib/contenttypes/fields.py b/django/contrib/contenttypes/fields.py
index 5b327b6..607444f 100644
--- a/django/contrib/contenttypes/fields.py
+++ b/django/contrib/contenttypes/fields.py
@@ -13,6 +13,7 @@ from django.db.models.fields.related import (
     ReverseManyToOneDescriptor,
     lazy_related_operation,
 )
+from django.db.models.fields.related_descriptors import _filter_prefetch_queryset
 from django.db.models.query_utils import PathInfo
 from django.db.models.sql import AND
 from django.db.models.sql.where import WhereNode
@@ -645,7 +646,11 @@ def create_generic_related_manager(superclass, rel):
             object_id_converter = instances[0]._meta.pk.to_python
             content_type_id_field_name = "%s_id" % self.content_type_field_name
             return (
-                queryset.filter(query),
+                _filter_prefetch_queryset(
+                    queryset,
+                    query,
+                    [self.content_type_field_name, self.object_id_field_name],
+                ),
                 lambda relobj: (
                     object_id_converter(getattr(relobj, self.object_id_field_name)),
                     getattr(relobj, content_type_id_field_name),
diff --git a/django/db/models/fields/related_descriptors.py b/django/db/models/fields/related_descriptors.py
index b192df4..632d782 100644
--- a/django/db/models/fields/related_descriptors.py
+++ b/django/db/models/fields/related_descriptors.py
@@ -64,14 +64,36 @@ and two directions (forward and reverse) for a total of six combinations.
 """
 
 from django.core.exceptions import FieldError
-from django.db import connections, router, transaction
-from django.db.models import Q, signals
+from django.db import NotSupportedError, connections, router, transaction
+from django.db.models import Q, Window, signals
+from django.db.models.functions import RowNumber
+from django.db.models.lookups import GreaterThan, LessThanOrEqual
 from django.db.models.query import QuerySet
 from django.db.models.query_utils import DeferredAttribute
 from django.db.models.utils import resolve_callables
 from django.utils.functional import cached_property
 
 
+def _filter_prefetch_queryset(queryset, predicate, partition_by):
+    if queryset.query.is_sliced:
+        db = queryset._db or router.db_for_read(queryset.model, **queryset._hints)
+        if not connections[db].features.supports_over_clause:
+            raise NotSupportedError(
+                "Prefetching from a limited queryset is only supported on backends "
+                "that support window functions."
+            )
+        low_mark, high_mark = queryset.query.low_mark, queryset.query.high_mark
+        order_by = [
+            expr for expr, _ in queryset.query.get_compiler(using=db).get_order_by()
+        ]
+        window = Window(RowNumber(), partition_by=partition_by, order_by=order_by)
+        predicate &= GreaterThan(window, low_mark)
+        if high_mark is not None:
+            predicate &= LessThanOrEqual(window, high_mark)
+        queryset.query.clear_limits()
+    return queryset.filter(predicate)
+
+
 class ForeignKeyDeferredAttribute(DeferredAttribute):
     def __set__(self, instance, value):
         if instance.__dict__.get(self.field.attname) != value and self.field.is_cached(
@@ -718,8 +740,9 @@ def create_reverse_many_to_one_manager(superclass, rel):
             rel_obj_attr = self.field.get_local_related_value
             instance_attr = self.field.get_foreign_related_value
             instances_dict = {instance_attr(inst): inst for inst in instances}
-            query = {"%s__in" % self.field.name: instances}
-            queryset = queryset.filter(**query)
+            queryset = _filter_prefetch_queryset(
+                queryset, Q(**{f"{self.field.name}__in": instances}), self.field.name
+            )
 
             # Since we just bypassed this class' get_queryset(), we must manage
             # the reverse relation manually.
@@ -1051,8 +1074,11 @@ def create_forward_many_to_many_manager(superclass, rel, reverse):
             queryset._add_hints(instance=instances[0])
             queryset = queryset.using(queryset._db or self._db)
 
-            query = {"%s__in" % self.query_field_name: instances}
-            queryset = queryset._next_is_sticky().filter(**query)
+            queryset = _filter_prefetch_queryset(
+                queryset._next_is_sticky(),
+                Q(**{f"{self.query_field_name}__in": instances}),
+                self.query_field_name,
+            )
 
             # M2M: need to annotate the query in order to get the primary model
             # that the secondary model was actually related to. We know that
diff --git a/django/db/models/query.py b/django/db/models/query.py
index be0deb9..e8159c5 100644
--- a/django/db/models/query.py
+++ b/django/db/models/query.py
@@ -2520,7 +2520,11 @@ def prefetch_one_level(instances, prefetcher, lookup, level):
             else:
                 manager = getattr(obj, to_attr)
                 if leaf and lookup.queryset is not None:
-                    qs = manager._apply_rel_filters(lookup.queryset)
+                    queryset = lookup.queryset
+                    if queryset.query.is_sliced:
+                        queryset = queryset._chain()
+                        queryset.query.clear_limits()
+                    qs = manager._apply_rel_filters(queryset)
                 else:
                     qs = manager.get_queryset()
                 qs._result_cache = vals
diff --git a/docs/ref/models/querysets.txt b/docs/ref/models/querysets.txt
index 223bb45..4e1b254 100644
--- a/docs/ref/models/querysets.txt
+++ b/docs/ref/models/querysets.txt
@@ -1270,6 +1270,18 @@ This can be used to change the default ordering of the queryset:
     >>> Restaurant.objects.prefetch_related(
     ...     Prefetch('pizzas__toppings', queryset=Toppings.objects.order_by('name')))
 
+For a multi-valued relation, the queryset can also be sliced to limit the
+number of related objects fetched for each instance. This requires database
+support for window functions:
+
+    >>> Restaurant.objects.prefetch_related(
+    ...     Prefetch('pizzas', queryset=Pizza.objects.order_by('name')[:3],
+    ...              to_attr='example_pizzas'))
+
+.. versionchanged:: 4.2
+
+    Support for sliced querysets was added.
+
 Or to call :meth:`~django.db.models.query.QuerySet.select_related()` when
 applicable to reduce the number of queries even further:
 
diff --git a/docs/releases/4.2.txt b/docs/releases/4.2.txt
index ed00ee1..42cbec4 100644
--- a/docs/releases/4.2.txt
+++ b/docs/releases/4.2.txt
@@ -189,6 +189,9 @@ Migrations
 Models
 ~~~~~~
 
+* :class:`~django.db.models.Prefetch` now supports sliced querysets for
+  prefetching multi-valued relations on databases that support window functions.
+
 * ``QuerySet`` now extensively supports filtering against
   :ref:`window-functions` with the exception of disjunctive filter lookups
   against window functions when performing aggregation.
```

## Patch I

```diff
diff --git a/django/contrib/contenttypes/fields.py b/django/contrib/contenttypes/fields.py
index 5b327b6..8d7bbb0 100644
--- a/django/contrib/contenttypes/fields.py
+++ b/django/contrib/contenttypes/fields.py
@@ -13,6 +13,7 @@ from django.db.models.fields.related import (
     ReverseManyToOneDescriptor,
     lazy_related_operation,
 )
+from django.db.models.fields.related_descriptors import _apply_rel_slicing
 from django.db.models.query_utils import PathInfo
 from django.db.models.sql import AND
 from django.db.models.sql.where import WhereNode
@@ -605,7 +606,14 @@ def create_generic_related_manager(superclass, rel):
             Filter the queryset for the instance this manager is bound to.
             """
             db = self._db or router.db_for_read(self.model, instance=self.instance)
-            return queryset.using(db).filter(**self.core_filters)
+            queryset = queryset.using(db)
+            if queryset.query.is_sliced:
+                return _apply_rel_slicing(
+                    queryset,
+                    models.Q(**self.core_filters),
+                    [self.content_type_field_name, self.object_id_field_name],
+                )
+            return queryset.filter(**self.core_filters)
 
         def _remove_prefetched_objects(self):
             try:
@@ -640,12 +648,17 @@ def create_generic_related_manager(superclass, rel):
                 )
             ]
             query = models.Q.create(content_type_queries, connector=models.Q.OR)
+            queryset = _apply_rel_slicing(
+                queryset,
+                query,
+                [self.content_type_field_name, self.object_id_field_name],
+            )
             # We (possibly) need to convert object IDs to the type of the
             # instances' PK in order to match up instances:
             object_id_converter = instances[0]._meta.pk.to_python
             content_type_id_field_name = "%s_id" % self.content_type_field_name
             return (
-                queryset.filter(query),
+                queryset,
                 lambda relobj: (
                     object_id_converter(getattr(relobj, self.object_id_field_name)),
                     getattr(relobj, content_type_id_field_name),
diff --git a/django/db/models/fields/related_descriptors.py b/django/db/models/fields/related_descriptors.py
index b192df4..cf736f5 100644
--- a/django/db/models/fields/related_descriptors.py
+++ b/django/db/models/fields/related_descriptors.py
@@ -64,14 +64,56 @@ and two directions (forward and reverse) for a total of six combinations.
 """
 
 from django.core.exceptions import FieldError
-from django.db import connections, router, transaction
-from django.db.models import Q, signals
+from django.db import (
+    DEFAULT_DB_ALIAS,
+    NotSupportedError,
+    connections,
+    router,
+    transaction,
+)
+from django.db.models import Q, Window, signals
+from django.db.models.functions import RowNumber
+from django.db.models.lookups import GreaterThan, LessThanOrEqual
 from django.db.models.query import QuerySet
 from django.db.models.query_utils import DeferredAttribute
 from django.db.models.utils import resolve_callables
 from django.utils.functional import cached_property
 
 
+def _filter_prefetch_queryset(queryset, field_name, instances):
+    return _apply_rel_slicing(
+        queryset, Q(**{f"{field_name}__in": instances}), field_name
+    )
+
+
+def _apply_rel_slicing(queryset, predicate, partition_by):
+    """
+    Apply `predicate` to `queryset`, replacing a slice (which can't be
+    combined with filter()) with an equivalent window function predicate
+    partitioned by `partition_by` (a field name or list of field names).
+    """
+    db = queryset._db or DEFAULT_DB_ALIAS
+    if queryset.query.is_sliced:
+        if not connections[db].features.supports_over_clause:
+            raise NotSupportedError(
+                "Prefetching from a limited queryset is only supported on "
+                "backends that support window functions."
+            )
+        low_mark, high_mark = queryset.query.low_mark, queryset.query.high_mark
+        order_by = [
+            expr
+            for expr, _ in queryset.query.get_compiler(
+                connection=connections[db]
+            ).get_order_by()
+        ]
+        window = Window(RowNumber(), partition_by=partition_by, order_by=order_by)
+        predicate &= GreaterThan(window, low_mark)
+        if high_mark is not None:
+            predicate &= LessThanOrEqual(window, high_mark)
+        queryset.query.clear_limits()
+    return queryset.filter(predicate)
+
+
 class ForeignKeyDeferredAttribute(DeferredAttribute):
     def __set__(self, instance, value):
         if instance.__dict__.get(self.field.attname) != value and self.field.is_cached(
@@ -403,8 +445,9 @@ class ReverseOneToOneDescriptor:
         rel_obj_attr = self.related.field.get_local_related_value
         instance_attr = self.related.field.get_foreign_related_value
         instances_dict = {instance_attr(inst): inst for inst in instances}
-        query = {"%s__in" % self.related.field.name: instances}
-        queryset = queryset.filter(**query)
+        queryset = _filter_prefetch_queryset(
+            queryset, self.related.field.name, instances
+        )
 
         # Since we're going to assign directly in the cache,
         # we must manage the reverse relation cache manually.
@@ -662,8 +705,13 @@ def create_reverse_many_to_one_manager(superclass, rel):
             queryset._add_hints(instance=self.instance)
             if self._db:
                 queryset = queryset.using(self._db)
-            queryset._defer_next_filter = True
-            queryset = queryset.filter(**self.core_filters)
+            if queryset.query.is_sliced:
+                queryset = _filter_prefetch_queryset(
+                    queryset, self.field.name, [self.instance]
+                )
+            else:
+                queryset._defer_next_filter = True
+                queryset = queryset.filter(**self.core_filters)
             for field in self.field.foreign_related_fields:
                 val = getattr(self.instance, field.attname)
                 if val is None or (val == "" and empty_strings_as_null):
@@ -718,8 +766,7 @@ def create_reverse_many_to_one_manager(superclass, rel):
             rel_obj_attr = self.field.get_local_related_value
             instance_attr = self.field.get_foreign_related_value
             instances_dict = {instance_attr(inst): inst for inst in instances}
-            query = {"%s__in" % self.field.name: instances}
-            queryset = queryset.filter(**query)
+            queryset = _filter_prefetch_queryset(queryset, self.field.name, instances)
 
             # Since we just bypassed this class' get_queryset(), we must manage
             # the reverse relation manually.
@@ -1028,6 +1075,10 @@ def create_forward_many_to_many_manager(superclass, rel, reverse):
             queryset._add_hints(instance=self.instance)
             if self._db:
                 queryset = queryset.using(self._db)
+            if queryset.query.is_sliced:
+                return _filter_prefetch_queryset(
+                    queryset._next_is_sticky(), self.query_field_name, [self.instance]
+                )
             queryset._defer_next_filter = True
             return queryset._next_is_sticky().filter(**self.core_filters)
 
@@ -1051,8 +1102,9 @@ def create_forward_many_to_many_manager(superclass, rel, reverse):
             queryset._add_hints(instance=instances[0])
             queryset = queryset.using(queryset._db or self._db)
 
-            query = {"%s__in" % self.query_field_name: instances}
-            queryset = queryset._next_is_sticky().filter(**query)
+            queryset = _filter_prefetch_queryset(
+                queryset._next_is_sticky(), self.query_field_name, instances
+            )
 
             # M2M: need to annotate the query in order to get the primary model
             # that the secondary model was actually related to. We know that
diff --git a/docs/ref/models/querysets.txt b/docs/ref/models/querysets.txt
index 223bb45..47d0aca 100644
--- a/docs/ref/models/querysets.txt
+++ b/docs/ref/models/querysets.txt
@@ -4023,6 +4023,20 @@ attribute:
     ``prefetch_related`` calls which store the cached result within a
     ``QuerySet`` instance.
 
+The ``queryset`` argument can also be a sliced ``QuerySet``, in which case the
+slice is applied separately to each prefetched relation::
+
+    >>> from django.db.models import Prefetch
+    >>> first_2_choices = Choice.objects.order_by('id')[:2]
+    >>> prefetch = Prefetch('choice_set', queryset=first_2_choices, to_attr='top_choices')
+    >>> Question.objects.prefetch_related(prefetch).get().top_choices
+    [<Choice: Not much>, <Choice: The sky>]
+
+.. note::
+
+    Using a sliced ``QuerySet`` with ``Prefetch()`` requires a database
+    backend that supports window functions.
+
 ``prefetch_related_objects()``
 ------------------------------
 
diff --git a/docs/releases/4.2.txt b/docs/releases/4.2.txt
index ed00ee1..90a3b20 100644
--- a/docs/releases/4.2.txt
+++ b/docs/releases/4.2.txt
@@ -193,6 +193,10 @@ Models
   :ref:`window-functions` with the exception of disjunctive filter lookups
   against window functions when performing aggregation.
 
+* :class:`~django.db.models.Prefetch` objects now support sliced querysets
+  for :meth:`~django.db.models.query.QuerySet.prefetch_related()`, on
+  database backends that support window functions.
+
 Requests and Responses
 ~~~~~~~~~~~~~~~~~~~~~~
 
```
