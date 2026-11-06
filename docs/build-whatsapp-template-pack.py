"""Generate the reviewable template catalogue; never submits templates or sends messages."""
import json, re, html
from pathlib import Path

ROOT = Path(__file__).resolve().parent
templates = []
def add(name, title, recipient, events, body, parameters, priority=1, status='Événement existant · raccordement WhatsApp à faire'):
    assert re.fullmatch(r'[a-z0-9_]+', name)
    matches = [int(n) for n in re.findall(r'\{\{(\d+)\}\}', body)]
    assert sorted(set(matches)) == list(range(1, len(parameters)+1)), name
    assert len(body) <= 1024, name
    assert not body.startswith('{{') and not body.endswith('}}'), name
    filled = body
    for i, (_, example) in enumerate(parameters, 1):
        filled = filled.replace('{{'+str(i)+'}}', example)
    templates.append(dict(name=name, title=title, language='fr', language_label='French / Français', category='UTILITY', recipient=recipient, events=events, priority=priority, status=status, body=body, parameters=[dict(position=i, meaning=meaning, example=example) for i,(meaning,example) in enumerate(parameters,1)], example=filled, header=None, footer='GM Fleet · Suivi de votre dossier', buttons=[]))

add('gml_alerte_encaissement_direction_fr','Paiement confirmé · direction','Eric Ebabi',['boss_payment:payment'],
    'GM Fleet — paiement confirmé.\nClient : {{1}}.\nContrat : {{2}}.\nMontant reçu : {{3}} {{4}}.\nPart GML : {{5}} {{4}}. Part LOLC : {{6}} {{4}}.\nMode : {{7}}. Date : {{8}}.\nRéférence : {{9}}.\nCet avis correspond à un encaissement enregistré.',
    [('Nom du client','Jean Exemple'),('Référence du contrat','GMF-CTR-2026-000099'),('Montant hors frais de transaction','177,00'),('Devise','USD'),('Part GML réelle de ce paiement','15,00'),('Part LOLC réelle de ce paiement','162,00'),('Mode','Espèces'),('Date du paiement','08/11/2026'),('Référence du reçu','CAISSE-20261108-EXEMPLE')])
add('gml_equipement_encaisse_direction_fr','Équipements encaissés · direction','Eric Ebabi',['boss_payment:equipment_received'],
    'GM Fleet — règlement équipements Car na ngai enregistré.\nClient : {{1}}. Montant encaissé : {{2}} USD.\nForfait prévu : 240 USD, soit tracker 130 USD + installation 20 USD + service 7,50 USD par mois × 12 = 90 USD.\nDate : {{3}}. Référence : {{4}}.\nLe montant encaissé ci-dessus est le paiement réel, même en cas de règlement partiel.',
    [('Client','Jean Exemple'),('Montant réellement reçu','240,00'),('Date','04/11/2026'),('Référence','EQUIPEMENT-EXEMPLE')])
add('gml_depot_lolc_direction_fr','Dépôt LOLC enregistré · direction','Eric Ebabi',['boss_payment:client_deposit_lolc'],
    'GM Fleet — dépôt client LOLC enregistré.\nClient : {{1}}. Dossier : {{2}}.\nMontant du dépôt : {{3}} USD.\nDate : {{4}}. Référence : {{5}}.\nPart GML sur cette écriture : 0 USD. Les équipements GML sont suivis dans leur règlement séparé.',
    [('Client','Jean Exemple'),('Dossier','CNG-2026-000099'),('Dépôt réellement confirmé','1400,00'),('Date','04/11/2026'),('Référence','DEPOT-EXEMPLE')])
add('gml_versement_confirme_fr','Reçu de versement · client','Chauffeur',['payment_receipt:payment'],
    'Bonjour {{1}}, votre versement GM Fleet de {{2}} {{3}} est confirmé.\nContrat : {{4}}. Date : {{5}}.\nMode : {{6}}. Référence du reçu : {{7}}.\nLe paiement a été enregistré dans votre dossier.',
    [('Chauffeur','Jean Exemple'),('Montant hors frais de transaction','177,00'),('Devise','USD'),('Contrat','GMF-CTR-2026-000099'),('Date','08/11/2026'),('Mode','Mobile Money'),('Référence','RECU-EXEMPLE')])
add('gml_versement_annule_fr','Contre-écriture · client et direction','Chauffeur / Eric, avec envois distincts',['payment_receipt:reversal','boss_payment:reversal'],
    'GM Fleet — annulation comptable de versement.\nClient : {{1}}. Contrat : {{2}}.\nMontant annulé : {{3}} {{4}}, dont GML {{5}} {{4}} et LOLC {{6}} {{4}}.\nRéférence initiale : {{7}}. Référence d’annulation : {{8}}.\nDate : {{9}}. Contactez GM Fleet pour toute question sur cette correction.',
    [('Client','Jean Exemple'),('Contrat','GMF-CTR-2026-000099'),('Montant','177,00'),('Devise','USD'),('Part GML annulée','15,00'),('Part LOLC annulée','162,00'),('Reçu initial','RECU-EXEMPLE'),('Contre-écriture','ANNULATION-EXEMPLE'),('Date','09/11/2026')])
add('gml_depot_lolc_confirme_fr','Reçu de dépôt LOLC · client','Client Car na ngai',['lolc_deposit_receipt'],
    'Bonjour {{1}}, votre dépôt client LOLC de {{2}} USD a été enregistré le {{3}}.\nDossier : {{4}}. Référence : {{5}}.\nCet avis confirme l’enregistrement du dépôt ; la suite du financement dépend de la décision LOLC.',
    [('Client','Jean Exemple'),('Dépôt','1400,00'),('Date','04/11/2026'),('Dossier','CNG-2026-000099'),('Référence','DEPOT-EXEMPLE')])
add('gml_proprietaire_mise_exploitation_fr','Démarrage du véhicule et prochaine retenue','Propriétaire externe',['owner_assignment'],
    'Bonjour {{1}}, votre véhicule {{2}}, plaque {{3}}, est confié au chauffeur {{11}} à partir du {{4}}.\nMandat : {{5}}.\nDette restante : {{6}} USD. Prochaine retenue prévue : {{7}} USD pour la période {{8}}.\nMontant propriétaire cible : {{9}} USD. Net prévisionnel : {{10}} USD.\nCette prévision dépend des encaissements et des ajustements convenus. Le paiement mensuel sera confirmé séparément.',
    [('Propriétaire','Marie Exemple'),('Modèle','Toyota Vitz'),('Plaque','TEST-099'),('Début réel','04/11/2026'),('Mandat propriétaire','GMF-MAN-2026-000099'),('Solde des avances','280,50'),('Retenue plafonnée au brut prévu','165,50'),('Période','novembre 2026'),('Montant brut cible convenu','500,00'),('Net prévisionnel','334,50'),('Nom du chauffeur affecté','Daniel Exemple')])
add('gml_proprietaire_recap_avance_fr','Détail d’une avance approuvée','Propriétaire externe',['owner_debt_recap'],
    'GM Fleet — récapitulatif de votre avance approuvée.\nPrestation : {{1}}.\nCoût initial : {{2}} USD. Frais uniques de 15 % : {{3}} USD. Total : {{4}} USD.\nSolde restant : {{5}} USD. Durée convenue : {{6}} mois.\nFin du remboursement : {{7}}. Accord : {{8}}.\nLes retenues suivent l’échéancier enregistré avec votre accord.',
    [('Prestation','Réparation moteur'),('Principal','200,00'),('Frais une seule fois','30,00'),('Total','230,00'),('Solde après récupérations','230,00'),('Durée de 1 à 6 mois','2'),('Échéance finale','31/12/2026'),('Accord enregistré','ACCORD-REPARATION-EXEMPLE')])
add('gml_proprietaire_paiement_mensuel_fr','Payout effectivement payé · propriétaire','Propriétaire externe',['owner_settlement'],
    'Bonjour {{1}}, votre règlement propriétaire GM Fleet a été enregistré comme payé.\nVéhicule : {{2}}, plaque {{3}}. Période : {{4}}.\nMontant propriétaire avant retenues : {{5}} USD. Remboursement des avances : {{6}} USD.\nNet payé : {{7}} USD le {{8}}.\nRéférence : {{9}}. Cet avis correspond au paiement confirmé par notre caisse.',
    [('Propriétaire','Marie Exemple'),('Véhicule','Toyota Vitz'),('Plaque','TEST-099'),('Période','01/11/2026 au 30/11/2026'),('Brut propriétaire','500,00'),('Retenue réelle','165,50'),('Net réellement payé','334,50'),('Date réelle','30/11/2026'),('Référence réelle','PROPRIETAIRE-EXEMPLE')])
add('gml_copie_contrat_fr','Copie de contrat à signer','Propriétaire / chauffeur partenaire',['contract_copy'],
    'Bonjour {{1}}, votre copie du contrat GM Fleet {{2}} est disponible.\nTéléchargement privé : {{3}}\nLe lien est valable 7 jours. Vérifiez vos informations, signez le document puis remettez la copie signée à votre agent GM Fleet. Le téléchargement ne constitue pas une signature.',
    [('Nom','Marie Exemple'),('Référence','GMF-MAN-2026-000099'),('Lien privé généré par le backend','https://gmfleet.georgemichaellogistics.cd/contrat.html#token=EXEMPLE_FICTIF')])
add('gml_contrat_active_fr','Contrat chauffeur activé','Chauffeur',['contract_activated'],
    'Bonjour {{1}}, votre contrat GM Fleet {{2}} est activé.\nVéhicule : {{3}}, plaque {{4}}. Début : {{5}}.\nPremier règlement : {{6}}. Rythme convenu : {{7}}. Montant habituel par règlement : {{8}} {{9}}.\nLes dates et montants enregistrés au contrat font référence.',
    [('Chauffeur','Jean Exemple'),('Contrat','GMF-CTR-2026-000099'),('Véhicule','Toyota Vitz'),('Plaque','TEST-099'),('Début','04/11/2026'),('Première date de règlement exigible, après calendrier hebdomadaire si applicable','05/11/2026'),('Rythme','lundi à vendredi'),('Montant correspondant au rythme, pas systématiquement le taux quotidien','31,00'),('Devise','USD')])
add('gml_rendez_vous_confirmation_fr','Rendez-vous confirmé ou reprogrammé','Client / chauffeur / propriétaire',['appointment'],
    'Bonjour {{1}}, votre rendez-vous GM Fleet est confirmé.\nObjet : {{2}}.\nDate : {{3}} à {{4}}, heure de Kinshasa.\nLieu : {{5}}. Dossier : {{6}}.\nPour une modification, contactez votre agent GM Fleet.',
    [('Nom','Jean Exemple'),('Objet','Entretien et test de conduite'),('Date','09/11/2026'),('Heure locale Kinshasa','10:30'),('Lieu réel du rendez-vous','Bureau GM Fleet, Gombe'),('Dossier','CHP-2026-000099')])
add('gml_rendez_vous_annule_fr','Annulation du rendez-vous','Client',['appointment_cancelled'],
    'Bonjour {{1}}, votre rendez-vous GM Fleet pour {{2}}, prévu le {{3}} à {{4}} heure de Kinshasa, est annulé.\nDossier : {{5}}. Contactez votre agent pour convenir d’une nouvelle date.',
    [('Nom','Jean Exemple'),('Objet','Entretien et test de conduite'),('Date','09/11/2026'),('Heure','10:30'),('Dossier','CHP-2026-000099')])
add('gml_candidature_recue_fr','Accusé de réception candidature','Client',['application_received'],
    'Bonjour {{1}}, GM Fleet a reçu votre candidature au programme {{2}}.\nRéférence du dossier : {{3}}.\nNotre équipe examine les informations transmises et vous contactera pour la suite. Conservez cette référence.',
    [('Nom','Jean Exemple'),('Programme','Car na ngai · LOLC'),('Dossier','CNG-2026-000099')])
add('gml_candidature_admin_fr','Nouvelle candidature · équipe','Administrateurs déjà désignés pour les candidatures',['admin_intake:application'],
    'GM Fleet — nouvelle candidature reçue.\nDossier : {{1}}. Nom : {{2}}.\nProgramme : {{3}}. Véhicule ou besoin déclaré : {{4}}.\nOuvrez l’espace opérations pour examiner les informations et les documents.',
    [('Dossier','CNG-2026-000099'),('Nom','Jean Exemple'),('Programme','Car na ngai · LOLC'),('Véhicule / besoin','Suzuki Swift')],2)
add('gml_dossier_retenu_fr','Candidature retenue','Client',['accepted'],
    'Bonjour {{1}}, votre candidature GM Fleet {{2}} au programme {{3}} a été retenue pour poursuivre les étapes de traitement.\nVotre agent vous indiquera la prochaine étape. Cette décision ne crée pas encore de contrat actif.',
    [('Nom','Jean Exemple'),('Dossier','CNG-2026-000099'),('Programme','Car na ngai · LOLC')],2)
add('gml_dossier_refuse_fr','Candidature refusée','Client',['rejected'],
    'Bonjour {{1}}, l’examen de votre candidature GM Fleet {{2}} est terminé. Le dossier n’a pas été retenu.\nObservation communiquée : {{3}}.\nVous pouvez contacter votre agent pour obtenir des précisions.',
    [('Nom','Jean Exemple'),('Dossier','CHP-2026-000099'),('Motif validé pour communication au client','Pièces requises non fournies après relance')],2)
add('gml_lolc_accord_fr','Accord LOLC confirmé','Client Car na ngai',['case_milestone:lolc_approved'],
    'Bonjour {{1}}, l’accord LOLC a été enregistré pour votre dossier GM Fleet {{2}}.\nGML poursuit la sélection et les contrôles du véhicule. Votre agent vous informera des prochaines étapes de votre financement.',
    [('Nom','Jean Exemple'),('Dossier','CNG-2026-000099')],2)
add('gml_lolc_complement_fr','Complément demandé par LOLC','Client Car na ngai',['case_milestone:information_required'],
    'Bonjour {{1}}, LOLC demande un complément pour votre dossier GM Fleet {{2}}.\nÉléments demandés : {{3}}.\nContactez votre agent pour transmettre ces éléments et poursuivre le traitement.',
    [('Nom','Jean Exemple'),('Dossier','CNG-2026-000099'),('Pièces / précisions réellement demandées','Justificatif de domicile actualisé')],2)
add('gml_lolc_refus_fr','Refus LOLC','Client Car na ngai',['case_milestone:lolc_rejected'],
    'Bonjour {{1}}, LOLC n’a pas approuvé le financement de votre dossier GM Fleet {{2}}.\nContactez votre agent GM Fleet pour les explications et les suites possibles concernant votre dossier.',
    [('Nom','Jean Exemple'),('Dossier','CNG-2026-000099')],2)
add('gml_equipements_installes_fr','Installation terminée','Client Car na ngai',['case_milestone:equipment_completed'],
    'Bonjour {{1}}, l’installation des équipements {{2}} est terminée pour le véhicule de votre dossier GM Fleet {{3}}.\nNotre équipe prépare les documents et la remise du véhicule. Votre agent vous communiquera les modalités.',
    [('Nom','Jean Exemple'),('Équipements réellement installés','tracker et caméra'),('Dossier','CNG-2026-000099')],2)
add('gml_vehicule_remis_fr','Remise du véhicule enregistrée','Client Car na ngai',['case_milestone:handover'],
    'Bonjour {{1}}, la remise de votre véhicule {{2}}, plaque {{3}}, a été enregistrée le {{4}} pour le dossier {{5}}.\nLes photos de l’état initial et le kilométrage sont conservés dans votre dossier. Les versements suivent les dates de votre contrat activé.',
    [('Nom','Jean Exemple'),('Véhicule','Suzuki Swift'),('Plaque','TEST-099'),('Date de remise','04/11/2026'),('Dossier','CNG-2026-000099')],2)
add('gml_chauffeur_pret_affectation_fr','Intégration chauffeur terminée','Chauffeur partenaire',['case_milestone:allocation'],
    'Bonjour {{1}}, votre intégration chauffeur GM Fleet est terminée pour le dossier {{2}}.\nVotre affectation sera confirmée selon les véhicules disponibles. Aucun versement ne commence avant l’activation de votre contrat et la date convenue.',
    [('Nom','Jean Exemple'),('Dossier','CHP-2026-000099')],2)
add('gml_yango_rattachement_fr','Rattachement Yango confirmé','Partenaire Yango',['case_milestone:yango_joined'],
    'Bonjour {{1}}, votre rattachement à GM Fleet sur Yango a été confirmé pour le dossier {{2}}.\nVotre agent reste votre contact pour le suivi de ce partenariat.',
    [('Nom','Jean Exemple'),('Dossier','YAN-2026-000099')],2)
add('gml_devis_recu_fr','Demande de devis équipements reçue','Demandeur équipements',['equipment_received'],
    'Bonjour {{1}}, GM Fleet a reçu votre demande de devis pour {{2}}.\nRéférence : {{3}}.\nNotre équipe vous contactera pour confirmer le besoin, le prix et la planification de l’installation.',
    [('Nom','Jean Exemple'),('Besoin','tracker et caméra'),('Référence de la demande','DEVIS-EXEMPLE')],2)
add('gml_devis_admin_fr','Nouvelle demande de devis · équipe','Administrateurs candidatures',['admin_intake:equipment_quote'],
    'GM Fleet — nouvelle demande de devis équipements.\nRéférence : {{1}}. Client : {{2}}.\nBesoin : {{3}}.\nOuvrez l’espace opérations pour examiner la demande et préparer la réponse.',
    [('Référence','DEVIS-EXEMPLE'),('Client','Jean Exemple'),('Besoin','tracker et caméra')],2)
add('gml_compte_equipe_invitation_fr','Création du compte personnel','Membre de l’équipe invité',['staff_invitation'],
    'Bonjour {{1}}, votre compte équipe GM Fleet a été créé avec le rôle {{2}}.\nPour terminer la configuration de votre accès, utilisez le lien personnel suivant : {{3}}\nNe partagez pas ce lien. Contactez votre administrateur s’il est expiré.',
    [('Nom','Agent Exemple'),('Rôle','Agent opérations'),('Lien personnel généré par le serveur','https://gmfleet.georgemichaellogistics.cd/set-password.html#token_hash=EXEMPLE_FICTIF')],2)

planned='Proposition · déclenchement absent ou à ajouter, ne pas activer automatiquement'
add('gml_documents_a_completer_fr','Pièces à compléter','Client',['proposed:documents_required'],
    'Bonjour {{1}}, votre dossier GM Fleet {{2}} nécessite les pièces suivantes : {{3}}.\nMerci de les transmettre à votre agent avant le {{4}} pour poursuivre le traitement.',
    [('Nom','Jean Exemple'),('Dossier','CNG-2026-000099'),('Pièces à fournir','Permis valide et justificatif de domicile'),('Date convenue','10/11/2026')],3,planned)
add('gml_rappel_rendez_vous_fr','Rappel de rendez-vous','Client',['proposed:appointment_reminder'],
    'Bonjour {{1}}, rappel de votre rendez-vous GM Fleet : {{2}}, le {{3}} à {{4}}, heure de Kinshasa.\nLieu : {{5}}. Dossier : {{6}}.\nContactez votre agent si vous devez modifier ce rendez-vous.',
    [('Nom','Jean Exemple'),('Objet','Entretien et conduite'),('Date','09/11/2026'),('Heure','10:30'),('Lieu','Bureau GM Fleet, Gombe'),('Dossier','CHP-2026-000099')],3,planned)
add('gml_rappel_versement_fr','Échéance quotidienne ou hebdomadaire','Chauffeur',['proposed:payment_due'],
    'Bonjour {{1}}, votre règlement GM Fleet du {{2}} arrive à échéance.\nContrat : {{3}}. Montant à régler : {{4}} {{5}}, dont échéances antérieures {{6}} {{5}}.\nCet avis suit votre calendrier contractuel. Si vous avez déjà payé, contactez la caisse avec votre reçu.',
    [('Nom','Jean Exemple'),('Date réelle de règlement, dimanche si hebdomadaire','08/11/2026'),('Contrat','GMF-CTR-2026-000099'),('Total dû','177,00'),('Devise','USD'),('Arriéré antérieur seulement','0,00')],3,planned)
add('gml_retard_versement_fr','Retard selon le calendrier réel','Chauffeur',['proposed:payment_overdue'],
    'Bonjour {{1}}, au {{2}}, un solde de {{3}} {{4}} reste en retard sur votre contrat GM Fleet {{5}}.\nPremière échéance dépassée : {{6}}.\nMerci de contacter la caisse pour vérifier la situation et convenir du règlement.',
    [('Nom','Jean Exemple'),('Date du constat, après échéance','09/11/2026'),('Arriéré réellement calculé','177,00'),('Devise','USD'),('Contrat','GMF-CTR-2026-000099'),('Échéance de règlement dépassée','08/11/2026')],3,planned)
add('gml_controle_dimanche_fr','Contrôle du dimanche','Chauffeur affecté',['proposed:sunday_inspection_reminder'],
    'Bonjour {{1}}, le contrôle GM Fleet de votre véhicule {{2}}, plaque {{3}}, est prévu le dimanche {{4}} à {{5}}, heure de Kinshasa.\nLieu : {{6}}.\nPrésentez le véhicule pour les vérifications, les photos et le relevé du kilométrage.',
    [('Nom','Jean Exemple'),('Véhicule','Toyota Vitz'),('Plaque','TEST-099'),('Dimanche','08/11/2026'),('Heure','09:00'),('Lieu','Centre de contrôle GM Fleet')],3,planned)
add('gml_reparation_accord_fr','Demande d’accord avant préfinancement','Propriétaire externe',['proposed:repair_approval_request'],
    'Bonjour {{1}}, pour votre véhicule {{2}}, plaque {{3}}, une réparation est proposée : {{4}}.\nCoût : {{5}} USD. Si GML préfinance, frais uniques de 15 % : {{6}} USD, total {{7}} USD, sur {{8}} mois.\nAucune avance n’est confirmée par cet avis. Contactez votre agent pour valider ou refuser ces conditions.',
    [('Nom','Marie Exemple'),('Véhicule','Toyota Vitz'),('Plaque','TEST-099'),('Diagnostic / prestation','Remplacement de la pompe à eau'),('Coût','200,00'),('15 % uniques','30,00'),('Total','230,00'),('Durée maximale 6 mois','2')],3,planned)
add('gml_signature_recue_fr','Copie signée vérifiée','Propriétaire / chauffeur',['proposed:signed_copy_verified'],
    'Bonjour {{1}}, GM Fleet a reçu et vérifié la copie signée de votre contrat {{2}} le {{3}}.\nLe document est conservé dans votre dossier. Votre agent vous informera de toute prochaine étape nécessaire.',
    [('Nom','Marie Exemple'),('Contrat','GMF-MAN-2026-000099'),('Date de vérification réelle','05/11/2026')],3,planned)
add('gml_service_indisponible_direction_fr','Incident opérationnel à vérifier','Direction',['proposed:operational_incident'],
    'GM Fleet — incident à vérifier.\nService concerné : {{1}}. Référence : {{2}}.\nConstat : {{3}}. Date : {{4}}.\nOuvrez le journal des opérations avant de relancer une action susceptible de créer un doublon.',
    [('Service','Paiement digital'),('Référence','TRANSACTION-EXEMPLE'),('Erreur vérifiée','Statut fournisseur non confirmé'),('Date et heure','04/11/2026 à 14:30, Kinshasa')],3,planned)

add('gml_affectation_chauffeur_fr','Affectation du chauffeur','Chauffeur',['proposed:driver_assignment_template'],
    'Bonjour {{1}}, vous êtes affecté au véhicule {{2}}, plaque {{3}}, du propriétaire {{4}}. Début du service : {{5}}. Premier versement : {{6}}. Montant habituel : {{7}} USD. Votre contrat GM Fleet fait référence.',
    [('Chauffeur','Daniel Exemple'),('Véhicule','Toyota Vitz'),('Plaque','TEST-099'),('Propriétaire','Marie Exemple'),('Début','09/11/2026'),('Premier versement','10/11/2026'),('Montant','31,00')],1,'Affectation existante · modèle WhatsApp spécialisé à raccorder')
add('gml_mobile_invitation_fr','Invitation GML Mobile','Propriétaire',['proposed:owner_mobile_invitation'],
    'Bonjour {{1}}, votre accès GML Mobile est prêt pour votre véhicule {{2}}, plaque {{3}}. Téléchargez l’application ici : {{4}}. Activez votre compte avec ce lien personnel : {{5}}. Ne partagez pas ce lien.',
    [('Propriétaire','Marie Exemple'),('Véhicule','Toyota Vitz'),('Plaque','TEST-099'),('Lien officiel de téléchargement','https://example.com/gml-mobile'),('Invitation privée','https://example.com/activation/EXEMPLE')],3,planned)
add('gml_service_suspendu_fr','Service suspendu','Propriétaire / chauffeur, envois distincts',['proposed:service_paused'],
    'Bonjour {{1}}, le service du véhicule {{2}}, plaque {{3}}, est suspendu à partir du {{4}}. Motif : {{5}}. Votre agent GM Fleet vous informera de la reprise.',
    [('Nom','Marie Exemple'),('Véhicule','Toyota Vitz'),('Plaque','TEST-099'),('Date','12/11/2026'),('Motif communiqué','Réparation en atelier')],3,planned)
add('gml_service_repris_fr','Reprise du service','Propriétaire / chauffeur, envois distincts',['proposed:service_resumed'],
    'Bonjour {{1}}, le service du véhicule {{2}}, plaque {{3}}, reprend le {{4}} avec le chauffeur {{5}}. Les dates de versement suivent le calendrier enregistré par GM Fleet.',
    [('Nom','Marie Exemple'),('Véhicule','Toyota Vitz'),('Plaque','TEST-099'),('Date','16/11/2026'),('Chauffeur','Daniel Exemple')],3,planned)
add('gml_fin_service_fr','Fin du service ou de l’affectation','Propriétaire / chauffeur, envois distincts',['proposed:service_ended'],
    'Bonjour {{1}}, la fin du service ou de l’affectation du véhicule {{2}}, plaque {{3}}, est enregistrée au {{4}}. Référence : {{5}}. Contactez votre agent GM Fleet pour les modalités de restitution et le bilan final.',
    [('Nom','Marie Exemple'),('Véhicule','Toyota Vitz'),('Plaque','TEST-099'),('Date','30/11/2026'),('Référence','FIN-EXEMPLE')],3,planned)
add('gml_inspection_resultat_fr','Résultat de l’inspection','Propriétaire / chauffeur, selon le dossier',['proposed:inspection_completed'],
    'Bonjour {{1}}, le contrôle du véhicule {{2}}, plaque {{3}}, a été effectué le {{4}}. Résultat : {{5}}. Prochaine action : {{6}}. Les photos et le kilométrage sont conservés par GM Fleet.',
    [('Nom','Marie Exemple'),('Véhicule','Toyota Vitz'),('Plaque','TEST-099'),('Date','08/11/2026'),('Résultat','Contrôle conforme'),('Action','Prochain contrôle dimanche')],3,planned)
add('gml_incident_vehicule_fr','Incident signalé sur le véhicule','Propriétaire / direction, selon le dossier',['proposed:vehicle_incident'],
    'Bonjour {{1}}, un incident a été signalé pour le véhicule {{2}}, plaque {{3}}, le {{4}}. Constat : {{5}}. Référence : {{6}}. GM Fleet vous contactera pour la suite. Aucun coût n’est approuvé par ce message.',
    [('Nom','Marie Exemple'),('Véhicule','Toyota Vitz'),('Plaque','TEST-099'),('Date','12/11/2026'),('Constat','Bruit moteur à vérifier'),('Référence','INCIDENT-EXEMPLE')],3,planned)
add('gml_suivi_indisponible_fr','GPS ou caméra indisponible','Propriétaire / équipe technique',['proposed:monitoring_offline'],
    'Bonjour {{1}}, les données {{2}} du véhicule {{3}}, plaque {{4}}, ne sont plus actualisées depuis le {{5}}. La dernière position connue ne confirme pas sa position actuelle. GM Fleet vérifie la connexion.',
    [('Nom','Marie Exemple'),('Service','GPS'),('Véhicule','Toyota Vitz'),('Plaque','TEST-099'),('Dernière communication','12/11/2026 à 10:30, Kinshasa')],3,planned)
add('gml_alerte_vehicule_fr','Alerte de surveillance configurée','Propriétaire / équipe autorisée',['proposed:monitoring_alert'],
    'Bonjour {{1}}, une alerte {{2}} a été détectée pour le véhicule {{3}}, plaque {{4}}, le {{5}}. Consultez GML Mobile pour vérifier les informations et contactez GM Fleet si nécessaire.',
    [('Nom','Marie Exemple'),('Type d’alerte','Sortie de la zone autorisée'),('Véhicule','Toyota Vitz'),('Plaque','TEST-099'),('Date','12/11/2026 à 10:40, Kinshasa')],3,planned)
add('gml_paiement_digital_statut_fr','Paiement digital non confirmé','Client',['proposed:digital_payment_status'],
    'Bonjour {{1}}, votre tentative de paiement GM Fleet de {{2}} USD, référence {{3}}, a le statut suivant : {{4}}. Ce message ne confirme aucun encaissement. Si votre compte a été débité, contactez la caisse avec cette référence avant une nouvelle tentative.',
    [('Nom','Daniel Exemple'),('Montant','31,00'),('Référence','PAIEMENT-EXEMPLE'),('Statut vérifié','En attente de confirmation du fournisseur')],3,planned)

# Debt collection is expressly restricted in Meta's current policy; do not disguise it as Utility.
for t in templates:
    t['submission_status']='DRAFT_NOT_SUBMITTED'
    t['meta_review_note']=None
    if t['name'] in ('gml_proprietaire_mise_exploitation_fr','gml_proprietaire_recap_avance_fr','gml_rappel_versement_fr','gml_reparation_accord_fr'):
        t['meta_review_note']='Messages liés aux avances ou au financement : faire confirmer leur admissibilité et leur qualification par Meta avant usage WhatsApp ; conserver les SMS en attendant.'
    if t['name']=='gml_retard_versement_fr':
        t['category']=None
        t['submission_status']='SMS_ONLY_DO_NOT_SUBMIT'
        t['status']='SMS seulement · ne pas soumettre à WhatsApp comme modèle de recouvrement'
        t['meta_review_note']='La politique WhatsApp interdit les usages de recouvrement de dettes. Ce brouillon reste une proposition SMS et ne doit pas être renommé ou déguisé en Utility.'

sources=[
 ('Meta — gestion des modèles','https://whatsappbusiness.com/blog/manage-message-templates-whatsapp-business-api/'),
 ('Meta — documentation des modèles','https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview'),
 ('Meta — politique de messagerie','https://business.whatsapp.com/policy'),
]
catalog=dict(prepared_on='2026-11-04',brand='GM Fleet',language='fr',live_transport='sms',whatsapp_connected=False,classification='UTILITY proposée ; Meta décide de la catégorie et de l’approbation.',templates=templates,sources=[dict(title=t,url=u) for t,u in sources])
ROOT.joinpath('whatsapp-templates.fr.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

assert len(templates) == len({t['name'] for t in templates})
import runpy
runpy.run_path(str(ROOT/'render-whatsapp-guide.py'))
