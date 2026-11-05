# GML Mobile — accès des propriétaires à leurs véhicules

## Recommandation

Créer l’accès depuis le dossier propriétaire déjà validé dans GM Fleet, puis envoyer une invitation personnelle. Le propriétaire définit son accès ou utilise un code de connexion vérifié dans GML Mobile. Il ne ressaisit ni sa voiture, ni ses équipements. Ne pas envoyer de mot de passe permanent en SMS.

## Liaison des données

Le dépôt actuel possède déjà la liaison `vehicles.owner_application_id → applications.id`. Cette liaison métier ne constitue pas encore un compte de connexion propriétaire.

Le raccordement proposé est :

`Utilisateur Supabase Auth → accès propriétaire approuvé → dossier propriétaire → véhicules → équipements GPS / caméra`

Une table d’accès administrée côté serveur relierait l’identifiant Auth au dossier propriétaire. Les droits seraient définis par rôle et par véhicule. La connexion seule ne donnerait pas accès à toutes les voitures. Ni le nom, ni la plaque, ni un numéro de téléphone saisi librement ne suffiraient pour réclamer une voiture.

## Parcours proposé

1. L’équipe valide le propriétaire et ses coordonnées dans GM Fleet.
2. L’équipe clique sur « Inviter sur GML Mobile ». Le serveur crée ou retrouve son identité, puis prépare une invitation à usage limité rattachée au bon dossier.
3. Le propriétaire ouvre l’invitation, vérifie son identité et active son accès.
4. GML Mobile récupère uniquement les véhicules autorisés pour cet utilisateur. Leur tracker et leur caméra sont associés par les identifiants enregistrés en base.
5. L’activation du service avec chauffeur produit séparément la notification d’affectation déjà prévue. Le droit de consulter son véhicule peut être accordé avant le premier jour de travail, si GM Fleet le décide.

Un propriétaire avec plusieurs véhicules utilise un seul compte. Le modèle actuel impose un dossier propriétaire par véhicule ; la future table d’accès doit donc pouvoir relier le même compte à plusieurs dossiers approuvés, sans supprimer cette contrainte à l’aveugle.

## Architecture recommandée

Si GML Mobile n’a pas encore de service d’authentification, utiliser le même projet Supabase Auth pour éviter deux identités et deux bases propriétaires. Chaque application conserve sa propre session. Se connecter au site ne connecte pas automatiquement l’application mobile.

Si l’application mobile possède déjà un backend, conserver éventuellement ce backend et établir un échange d’identité sécurisé côté serveur ; ne pas copier les mots de passe entre applications.

Les règles RLS et les API de suivi doivent vérifier l’accès au véhicule pour chaque requête. Les flux vidéo passent par des URL ou jetons temporaires délivrés après cette vérification. Les clés du fournisseur GPS/caméra restent côté serveur. Le chauffeur n’obtient pas les droits de propriétaire par sa seule affectation ; les droits du chauffeur doivent être définis séparément et expirer avec l’affectation.

Une connexion validée et des identifiants de caméra ne créent pas à eux seuls le suivi en direct. Il faut raccorder le fournisseur GPS et vidéo, ses flux, ses autorisations et ses états de connexion. Voir les personnes dans une vidéo est différent d’une identification automatique des personnes, qui n’est pas promise par ce parcours.

## État vérifié dans ce dépôt

Les dossiers propriétaires, véhicules, équipements et affectations existent. Aucun parcours propriétaire Auth complet pour GML Mobile n’a été identifié dans ce dépôt. Le code de l’application mobile et son fournisseur de suivi n’ont pas été inspectés ici. Ce document propose le raccordement ; il ne déploie pas de nouveaux comptes ou droits.

Références : [gestion des utilisateurs Supabase](https://supabase.com/docs/guides/auth/managing-user-data), [contrôle d’accès RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
