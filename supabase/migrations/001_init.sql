-- Verdict cache: each (prompt, normalized answer) is judged by the LLM at most once.
create table if not exists verdicts (
  prompt_id  text not null,
  norm       text not null,
  valid      boolean not null,
  canonical  text,
  created_at timestamptz not null default now(),
  primary key (prompt_id, norm)
);

-- In-progress play state, written only by the server so timers can't be faked.
create table if not exists sessions (
  date       date not null,
  device_id  text not null,
  run        jsonb not null,
  submitted  boolean not null default false,
  primary key (date, device_id)
);

-- Final scores; one per device per day.
create table if not exists scores (
  date       date not null,
  device_id  text not null,
  handle     text not null,
  total      int  not null,
  survived_ms int not null default 0,
  created_at timestamptz not null default now(),
  primary key (date, device_id)
);
create index if not exists scores_date_total on scores (date, total desc);

create or replace view all_time_scores as
  select device_id, (array_agg(handle order by date desc))[1] as handle,
         sum(total)::int as total, count(*)::int as days
  from scores group by device_id;

-- All access goes through the server with the service role key.
alter table verdicts enable row level security;
alter table sessions enable row level security;
alter table scores   enable row level security;
