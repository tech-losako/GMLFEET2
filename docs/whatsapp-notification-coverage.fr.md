# Couverture des notifications GM Fleet

Le catalogue contient 45 messages, plus un modèle Authentication à configurer dans Meta. Le backend est raccordé ; l’activation attend les clés Meta valides et les tests réels de réception. Les événements proposés ne sont pas des fonctions déjà déployées.

| Notification | Destinataire | État |
|---|---|---|
| Paiement confirmé · direction | Eric Ebabi | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Équipements encaissés · direction | Eric Ebabi | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Dépôt LOLC enregistré · direction | Eric Ebabi | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Reçu de versement · client | Chauffeur | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Contre-écriture · client et direction | Chauffeur / Eric, avec envois distincts | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Reçu de dépôt LOLC · client | Client Car na ngai | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Démarrage du véhicule et prochaine retenue | Propriétaire externe | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Détail d’une avance approuvée | Propriétaire externe | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Payout effectivement payé · propriétaire | Propriétaire externe | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Copie de contrat à signer | Propriétaire / chauffeur partenaire | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Contrat chauffeur activé | Chauffeur | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Rendez-vous confirmé ou reprogrammé | Client / chauffeur / propriétaire | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Annulation du rendez-vous | Client | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Accusé de réception candidature | Client | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Nouvelle candidature · équipe | Administrateurs déjà désignés pour les candidatures | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Candidature retenue | Client | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Candidature refusée | Client | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Accord LOLC confirmé | Client Car na ngai | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Complément demandé par LOLC | Client Car na ngai | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Refus LOLC | Client Car na ngai | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Installation terminée | Client Car na ngai | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Remise du véhicule enregistrée | Client Car na ngai | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Intégration chauffeur terminée | Chauffeur partenaire | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Rattachement Yango confirmé | Partenaire Yango | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Demande de devis équipements reçue | Demandeur équipements | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Nouvelle demande de devis · équipe | Administrateurs candidatures | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Création du compte personnel | Membre de l’équipe invité | Événement raccordé · modèle Meta et autorisation vérifiés avant envoi |
| Pièces à compléter | Client | Proposition · déclenchement absent ou à ajouter, ne pas activer automatiquement |
| Rappel de rendez-vous | Client | Proposition · déclenchement absent ou à ajouter, ne pas activer automatiquement |
| Échéance quotidienne ou hebdomadaire | Chauffeur | Déployée en SMS · deux nouveaux brouillons WhatsApp à faire valider, voir whatsapp-payment-reminder-templates.fr.md |
| Retard selon le calendrier réel | Chauffeur | SMS seulement · ne pas soumettre à WhatsApp comme modèle de recouvrement |
| Contrôle du dimanche | Chauffeur affecté | Proposition · déclenchement absent ou à ajouter, ne pas activer automatiquement |
| Demande d’accord avant préfinancement | Propriétaire externe | Proposition · déclenchement absent ou à ajouter, ne pas activer automatiquement |
| Copie signée vérifiée | Propriétaire / chauffeur | Proposition · déclenchement absent ou à ajouter, ne pas activer automatiquement |
| Incident opérationnel à vérifier | Direction | Proposition · déclenchement absent ou à ajouter, ne pas activer automatiquement |
| Affectation du chauffeur | Chauffeur | Affectation existante · modèle WhatsApp spécialisé à raccorder |
| Invitation GML Mobile | Propriétaire | Proposition · déclenchement absent ou à ajouter, ne pas activer automatiquement |
| Service suspendu | Propriétaire / chauffeur, envois distincts | Proposition · déclenchement absent ou à ajouter, ne pas activer automatiquement |
| Reprise du service | Propriétaire / chauffeur, envois distincts | Proposition · déclenchement absent ou à ajouter, ne pas activer automatiquement |
| Fin du service ou de l’affectation | Propriétaire / chauffeur, envois distincts | Proposition · déclenchement absent ou à ajouter, ne pas activer automatiquement |
| Résultat de l’inspection | Propriétaire / chauffeur, selon le dossier | Proposition · déclenchement absent ou à ajouter, ne pas activer automatiquement |
| Incident signalé sur le véhicule | Propriétaire / direction, selon le dossier | Proposition · déclenchement absent ou à ajouter, ne pas activer automatiquement |
| GPS ou caméra indisponible | Propriétaire / équipe technique | Proposition · déclenchement absent ou à ajouter, ne pas activer automatiquement |
| Alerte de surveillance configurée | Propriétaire / équipe autorisée | Proposition · déclenchement absent ou à ajouter, ne pas activer automatiquement |
| Paiement digital non confirmé | Client | Proposition · déclenchement absent ou à ajouter, ne pas activer automatiquement |

Les propriétaires reçoivent leur affectation, les informations convenues sur leurs avances et leur paiement mensuel effectivement payé. Ils ne reçoivent pas chaque versement du chauffeur. Eric Ebabi reçoit les alertes de caisse. La case de notification reste respectée pour les rendez-vous. Les alertes GPS/caméra nécessitent des données et déclencheurs réellement fournis par GML Mobile ; une caméra seule ne permet pas d’identifier automatiquement les personnes.

[Politique officielle WhatsApp](https://whatsappbusiness.com/policy/) : recouvrement par WhatsApp interdit ; conserver ce message en SMS.
