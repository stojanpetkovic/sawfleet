-- Public storage bucket for blog post cover images. No storage.objects RLS
-- policies needed — same pattern as external-lead-photos: public bucket,
-- all writes go through supabaseAdmin (service role) inside API routes.

insert into storage.buckets (id, name, public)
values ('blog-post-covers', 'blog-post-covers', true)
on conflict (id) do nothing;
