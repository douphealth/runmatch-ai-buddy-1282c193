
-- Drip log: idempotency for marketing email sends
CREATE TABLE public.email_drip_log (
  id BIGSERIAL PRIMARY KEY,
  contact_email TEXT NOT NULL,
  template_id INT NOT NULL,
  day_offset INT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  brevo_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT,
  UNIQUE(contact_email, template_id)
);
CREATE INDEX idx_email_drip_log_email ON public.email_drip_log(contact_email);
CREATE INDEX idx_email_drip_log_sent_at ON public.email_drip_log(sent_at DESC);

ALTER TABLE public.email_drip_log ENABLE ROW LEVEL SECURITY;
-- No public policies: only service role (edge functions) accesses this.

-- Engagement events from Brevo webhook
CREATE TABLE public.email_engagement_events (
  id BIGSERIAL PRIMARY KEY,
  contact_email TEXT NOT NULL,
  event TEXT NOT NULL,
  template_id INT,
  link TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw JSONB
);
CREATE INDEX idx_engagement_email ON public.email_engagement_events(contact_email);
CREATE INDEX idx_engagement_event ON public.email_engagement_events(event);
ALTER TABLE public.email_engagement_events ENABLE ROW LEVEL SECURITY;
