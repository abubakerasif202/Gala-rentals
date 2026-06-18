ALTER TABLE toll_transfer_notices
  ALTER COLUMN toll_notice_number DROP NOT NULL,
  ALTER COLUMN declaration_date DROP NOT NULL;
