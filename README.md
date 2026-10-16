# PDF Changer

Éditeur de PDF local avec interface web : supprimer, modifier, déplacer et ajouter des éléments en quelques clics.
Tout se passe sur votre machine, aucun fichier n'est envoyé sur Internet.

## Lancer

Double-cliquez sur **`Lancer PDF Changer.bat`** (les dépendances s'installent toutes seules au premier lancement),
ou bien :

```
pip install -r requirements.txt
python app.py
```

Le navigateur s'ouvre sur l'application (http://127.0.0.1:5173 par défaut).

## Ce qu'on peut faire

| Action | Comment |
| --- | --- |
| Supprimer un élément (texte, image, forme, annotation, champ) | Clic dessus puis `Suppr` (ou la mini-barre « Supprimer ») |
| Réécrire un paragraphe | Double-clic dessus : le texte se remet en forme tout seul dans la largeur du bloc (alignement conservé : gauche, centré, droite, justifié) |
| Réécrire une seule ligne | `Alt` + double-clic (ou « Ligne seule » dans la mini-barre) ; une ligne au style mixte (mot en gras, exposant) garde ses styles |
| Mettre en forme pendant l'édition | Barre flottante : police, taille, gras, italique, couleur, alignement ; poignée à droite pour changer la largeur |
| Texte incliné ou pivoté | Se réécrit comme les autres, à son angle d'origine |
| Rechercher / remplacer | `Ctrl+F` / `Ctrl+H` — le style de chaque mot est conservé |
| PDF scanné | À l'ouverture, « Rendre le texte modifiable » lance la reconnaissance de texte (OCR) ; ensuite tout se modifie comme un PDF normal |
| Ajouter un texte | Double-clic dans une zone vide (ou outil `T`) |
| Déplacer / redimensionner | Glisser l'élément / tirer les poignées ; flèches du clavier pour ajuster |
| Dupliquer | `Ctrl+D` ou `Alt` + glisser |
| Copier / couper / coller des éléments | `Ctrl+C`, `Ctrl+X`, `Ctrl+V` — aussi vers une autre page ; le texte copié se colle aussi ailleurs |
| Toutes les actions d'un élément ou d'une page | Clic droit (sur la page ou sur une miniature) |
| Aligner proprement | En glissant, des guides roses apparaissent et l'élément s'aimante aux bords et centres (page et autres éléments) ; `Ctrl` pour désactiver |
| Sélection multiple | `Maj`+clic ou tracer un cadre dans le vide |
| Ajouter une image | Outil `I`, `Ctrl+V` d'une image copiée, ou glisser un fichier image sur la page |
| Formes, flèches, dessin libre | Outils `R`, `O`, `L`, `A`, `D` |
| Signature réutilisable | Outil `D` → « Créer une signature » (ou « Garder comme signature » après un dessin) ; ensuite un clic sur la signature puis sur la page, ou clic droit → « Signer ici » |
| Remplir un formulaire | Cliquer dans un champ (fond bleuté) et taper ; `Tab` passe au champ suivant, `Entrée` valide ; cases à cocher, boutons radio et listes se remplissent d'un clic |
| Surligner | Outil `H` |
| Masquer une zone (cache blanc) | Outil `W` |
| Effacer tout le contenu d'une zone | Outil `E` (gomme) |
| Pages : pivoter, dupliquer, supprimer, réordonner, page blanche | Miniatures à gauche (survol + glisser-déposer) ; `Ctrl`/`Maj`+clic pour en sélectionner plusieurs et agir sur toutes |
| Aller à une page | Numéro de page en haut, `PageUp` / `PageDown`, flèches sur les miniatures |
| Zoom | Menu du pourcentage (50 % à 400 %, largeur, page entière), `Ctrl`+molette, `Ctrl+0` / `Ctrl+9` |
| Fusionner un autre PDF ou une image | « Insérer un PDF / une image » ou glisser le fichier sur une miniature |
| Annuler / Rétablir | `Ctrl+Z` / `Ctrl+Y` (80 niveaux, instantané même sur un gros PDF), ou « Annuler » dans la notification |
| Enregistrer | `Ctrl+S` ou « Enregistrer » (choix de l'emplacement dans Chrome/Edge) ; un point ● à côté du nom signale des modifications non enregistrées, et l'application demande confirmation avant d'ouvrir un autre document |
| Exporter une partie ou réduire la taille | Flèche à côté d'« Enregistrer » (`Ctrl+Maj+S`) : pages choisies, images recompressées pour l'e-mail ; « Extraire » sur des miniatures sélectionnées |
| Tout au clavier | `Tab` / `Maj+Tab` parcourt les éléments de la page, `Entrée` modifie, flèches pour déplacer, `Maj+F10` (ou touche Menu) ouvre le menu de l'élément |
| Petit écran, tablette | Sous ~900 px les réglages, sous ~700 px les miniatures, se replient derrière deux boutons en haut ; au doigt, un élément sélectionné se déplace |
| Aide | `?` ou le bouton ⓘ — et la barre du bas indique toujours ce que l'on peut faire avec l'élément survolé |

La suppression est **réelle** (le contenu est retiré du fichier, pas seulement caché), sauf pour l'outil « cache blanc ».

Le PDF enregistré est compact : les polices ajoutées sont réduites aux seuls caractères utilisés.

## Sécurité

Le serveur n'écoute que sur l'ordinateur (127.0.0.1). Chaque lancement crée un jeton secret connu de la seule
page de l'application : un autre site ouvert dans le navigateur ne peut ni lire ni modifier vos documents.

## Reconnaissance de texte (OCR)

Elle utilise le moteur OCR **intégré à Windows 10/11** (rien n'est envoyé sur Internet) et la langue
d'affichage de Windows. Une page dure moins d'une seconde. Les pages couchées ou à l'envers sont redressées
automatiquement. Après l'OCR, modifier une ligne recouvre l'ancienne de la couleur du fond et réécrit le
texte dans la couleur détectée.

## Limites connues

- Le texte écrit de droite à gauche (hébreu, arabe) ne peut pas encore être réécrit : l'application le signale et
  laisse la ligne telle quelle. Le chinois, le japonais, le coréen et les symboles utilisent automatiquement une
  police de Windows qui les contient.
- Un texte modifié réutilise la police d'origine si elle est intégrée au PDF et contient les caractères nécessaires ;
  sinon une police proche (Helvetica/Times/Courier ou Arial…) est utilisée.
- Quand un paragraphe est réécrit, il prend un style unique (celui de sa ligne principale) : un mot en gras au
  milieu redevient normal. Pour garder ces styles, utilisez « Rechercher / remplacer » ou modifiez la ligne seule.
- L'OCR peut se tromper sur des caractères rares ou des scans de mauvaise qualité ; il ne lit pas le texte
  incliné en biais dans une image.
