begin;
-- Match the catalogue body actually verified as APPROVED in Meta. Test labels
-- explicitly say no real request is created; no application row is inserted.
do $patch$declare definition text;begin
 definition:=pg_get_functiondef('private.authorize_whatsapp_test(text,text,boolean,uuid)'::regprocedure);
 definition:=replace(definition,'''gml_candidature_recue_fr''','''gml_devis_recu_fr''');
 definition:=replace(definition,'Test WhatsApp sans candidature','Test WhatsApp sans devis réel');
 execute definition;
end $patch$;
commit;
