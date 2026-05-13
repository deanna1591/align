-- Make tasks.date nullable to support a "Someday" bucket (tasks with no date)
alter table public.tasks alter column date drop not null;
