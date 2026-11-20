create function public.psst_lti_signing_material()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('kid', key.public_jwk->>'kid', 'privateJwk', secret.decrypted_secret::jsonb)
  from psst_pilot.lti_tool_key key
  join vault.decrypted_secrets secret on secret.id = key.vault_id
  where key.singleton;
$$;
revoke execute on function public.psst_lti_signing_material() from public, anon, authenticated;
grant execute on function public.psst_lti_signing_material() to service_role;
