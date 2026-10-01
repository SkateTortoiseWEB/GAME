-- Atomic named counters, used for the daily AI-check budget.
create table if not exists counters (
  key   text primary key,
  value int not null default 0
);

create or replace function bump_counter(k text) returns int
language sql as $$
  insert into counters (key, value) values (k, 1)
  on conflict (key) do update set value = counters.value + 1
  returning value;
$$;
