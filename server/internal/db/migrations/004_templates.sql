-- Invoice templates: a style now also names one of the built-in print templates.
-- Empty means the original Mavri layout, so documents issued earlier look the same.
ALTER TABLE styles ADD COLUMN template TEXT NOT NULL DEFAULT '';
