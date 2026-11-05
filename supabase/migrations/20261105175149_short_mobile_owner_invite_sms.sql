begin;
create or replace function private.mobile_owner_invite_sms(p jsonb) returns text language plpgsql security definer set search_path='' as $$
declare i public.mobile_owner_invites;code text;
begin
 select * into i from public.mobile_owner_invites where id=(p->>'invite_id')::uuid;
 if not found or i.revoked_at is not null or i.redeemed_at is not null or i.expires_at<=now() or i.failed_attempts>=5 then return null;end if;
 code:=private.mobile_invite_code(i.id);
 return 'GM Fleet : code GML Mobile '||left(code,4)||'-'||right(code,4)||'. Valable 72 h. Ne partagez pas ce code.';
end $$;
revoke all on function private.mobile_owner_invite_sms(jsonb) from public,anon,authenticated;
grant execute on function private.mobile_owner_invite_sms(jsonb) to service_role;
commit;
