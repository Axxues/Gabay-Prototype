-- Task 6 (activities merge, Step 4 data-first decision): the Discussion
-- audience field drops the pre-merge name. Dev-DB check 2026-09-17: zero
-- Discussion rows carry a value, so the column is renamed with values
-- preserved (table is empty; sp_rename is a metadata-only rename).
EXEC sp_rename 'Discussion.groupAssignment', 'groupActivity', 'COLUMN';
