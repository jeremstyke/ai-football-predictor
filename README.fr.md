<div align="center">

# ⚽ AI Football Predictor

**Probabilités de victoire, de nul et de défaite pour chaque match de foot, vérifiées sur les vrais résultats.**
*The win, draw and loss probability of every football match, checked against real results.*

[![Ouvrir l'appli](https://img.shields.io/badge/Ouvrir_l'appli-3ee0a8?style=for-the-badge&logo=googlechrome&logoColor=06090e)](https://aifootpredictor.com/fr/?src=github)
[![Telegram](https://img.shields.io/badge/Mini_app_Telegram-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/ai_football_predictorbot/app?startapp=src_github)
[![Chaîne](https://img.shields.io/badge/Chaîne_Telegram-0b1118?style=for-the-badge&logo=telegram&logoColor=26A5E4)](https://t.me/aifootballpredictorchannel)
[![English](https://img.shields.io/badge/🇬🇧_English-1b2533?style=for-the-badge)](README.md)

<a href="https://aifootpredictor.com/fr/blog/?src=github"><img src="https://txvrlvcxfnylnrpdrxtt.supabase.co/functions/v1/afp-og?n=52" alt="Avant-match AI Football Predictor : probabilités du match avec les logos des deux clubs" width="720"></a>

</div>

---

## Sommaire

- [C'est quoi AI Football Predictor ?](#cest-quoi-ai-football-predictor-)
- [Fonctionnalités](#fonctionnalités)
- [Comment sont calculées les probabilités](#comment-sont-calculées-les-probabilités)
- [Fiabilité vérifiable](#fiabilité-vérifiable)
- [Compétitions couvertes](#compétitions-couvertes)
- [Widget gratuit pour votre site](#widget-gratuit-pour-votre-site)
- [Articles avant-match](#articles-avant-match)
- [API de probabilités foot](#api-de-probabilités-foot)
- [Questions fréquentes](#questions-fréquentes)

---

## C'est quoi AI Football Predictor ?

**AI Football Predictor** est une appli gratuite qui calcule, pour chaque match de football, la probabilité de **victoire à domicile**, de **match nul** et de **victoire à l'extérieur** (1 / N / 2), avec les **buts attendus (xG)**, le **score le plus probable**, la probabilité de **plus de 2,5 buts**, et le **direct** pendant le match.

Chaque probabilité est **verrouillée avant le coup d'envoi**, puis comparée au vrai résultat. Rien n'est effacé après coup : l'onglet Fiabilité montre ce qu'on annonçait et ce qui s'est passé.

L'appli marche partout :

| Où | Lien |
|---|---|
| 🌐 Site web et web app (installable sur iPhone et Android) | [aifootpredictor.com](https://aifootpredictor.com/fr/?src=github) |
| ✈️ Mini app Telegram | [t.me/ai_football_predictorbot/app](https://t.me/ai_football_predictorbot/app?startapp=src_github) |
| 📣 Chaîne Telegram (les matchs les plus probables du jour) | [t.me/aifootballpredictorchannel](https://t.me/aifootballpredictorchannel) |
| 📰 Blog (avant-matchs, guides) | [Blog](https://aifootpredictor.com/fr/blog/?src=github) |

---

## Fonctionnalités

- **Probabilités 1 / N / 2** pour chaque match, chaque jour.
- **Les matchs les plus probables du jour** : ceux où une issue dépasse nettement les autres.
- **Buts attendus (xG)** et **score exact le plus probable**, avec la grille complète des scores.
- **Plus / moins de 2,5 buts** et **les deux équipes marquent**.
- **Direct** : score, minute, buteurs, et la probabilité qui bouge pendant le match.
- **Suivre un match** : alertes avant le coup d'envoi, à chaque but, à la mi-temps et à la fin (notifications sur la web app, messages du bot sur Telegram).
- **Fiches équipes et compétitions** : forme, prochains matchs, classement.
- **Classements probables de fin de saison** : chances de titre, de top 4 et de relégation, calculées par simulation.
- **Défie le modèle** : un jeu sur Telegram où tu essaies de faire mieux que l'IA, seul ou entre amis.
- **Articles avant-match** écrits par notre IA à partir de nos seules données.
- **Gratuit**, sans inscription sur le site.

---

## Comment sont calculées les probabilités

1. **Force des équipes** : pour chaque équipe, on estime une force d'attaque et une force de défense à partir des matchs récents, en donnant plus de poids aux matchs les plus proches et en tenant compte de l'avantage du terrain.
2. **Buts attendus** : on en déduit le nombre de buts attendus de chaque équipe pour ce match (xG du modèle).
3. **Loi de Poisson** : à partir des buts attendus, on calcule la probabilité de chaque score (0-0, 1-0, 1-1, 2-1...). En additionnant les scores, on obtient la victoire, le nul et la défaite, le plus de 2,5 buts et les deux équipes marquent.
4. **Verrouillage** : la probabilité est figée avant le match, puis comparée au résultat réel.

La méthode complète est expliquée ici : **[Méthode](https://aifootpredictor.com/fr/methode/?src=github)**.
Guides : [le modèle de Poisson expliqué](https://aifootpredictor.com/fr/blog/comment-un-modele-de-poisson-predit-les-scores-au-football/?src=github), [plus/moins de 2,5 buts](https://aifootpredictor.com/fr/blog/plus-moins-de-2-5-buts-comment-la-probabilite-est-calculee/?src=github).

> Ce sont des **probabilités, pas des certitudes**. Une issue à 60 % ne se produit pas 4 fois sur 10, et c'est normal.

---

## Fiabilité vérifiable

Beaucoup de sites de pronostics n'affichent que leurs réussites. Ici :

- chaque probabilité est publiée **avant** le match et ne peut plus être modifiée ;
- chaque résultat est ajouté automatiquement après le match ;
- l'historique complet, réussites et échecs, est **public** dans l'onglet **Fiabilité** de l'appli.

👉 [Voir la fiabilité en direct](https://aifootpredictor.com/fr/?src=github)

---

## Compétitions couvertes

Plus de 25 compétitions, dont :

| Pays / Europe | Compétitions |
|---|---|
| 🇪🇺 Europe | Ligue des champions |
| 🏴 Angleterre | Premier League, FA Cup, EFL Cup |
| 🇪🇸 Espagne | LaLiga, Copa del Rey |
| 🇮🇹 Italie | Serie A |
| 🇩🇪 Allemagne | Bundesliga, DFB-Pokal |
| 🇫🇷 France | Ligue 1 |
| 🇵🇹 Portugal | Liga Portugal, Taça de Portugal |
| 🇳🇱 Pays-Bas | Eredivisie |
| 🏴 Écosse | Scottish Premiership, Scottish Cup, League Cup |
| 🇧🇪 🇹🇷 🇬🇷 | Pro League, Süper Lig, Super League |
| 🌍 Et aussi | Brésil, Argentine, Arabie saoudite, Norvège, Roumanie, Croatie, Serbie, Ukraine, Bulgarie, Chypre |

---

## Widget gratuit pour votre site

Affichez les probabilités sur votre site ou votre blog, **gratuitement**, mises à jour automatiquement.

```html
<div class="afp-widget" data-lang="fr" data-lg="F1,CL" data-n="6">
  <a href="https://aifootpredictor.com/fr/">Probabilités foot par AI Football Predictor</a>
</div>
<script src="https://aifootpredictor.com/embed.js" async></script>
```

Types disponibles : matchs du jour, direct (`data-type="live"`), un match précis (`data-type="match"`), une équipe (`data-type="team"`), un classement probable (`data-type="table"`), la liste des avant-matchs (`data-type="articles"`).

👉 [Tous les widgets et le générateur de code](https://aifootpredictor.com/fr/widget/?src=github)

---

## Articles avant-match

Pour les gros matchs, notre IA écrit un **avant-match** à partir de nos seules données : probabilités, buts attendus, forme récente, classement, confrontations. L'article est mis à jour avec le résultat après le match.

- 📰 [Lire les avant-matchs sur le blog](https://aifootpredictor.com/fr/blog/?src=github)
- 📋 [Widget gratuit des avant-matchs pour votre site](https://aifootpredictor.com/fr/widget/articles/?src=github)
- 📡 [Flux RSS](https://aifootpredictor.com/fr/feed.xml)

---

## API de probabilités foot

Pour les médias, applis et développeurs : probabilités 1 / N / 2, buts attendus, score le plus probable, direct, classements simulés, historique de fiabilité et articles avant-match prêts à publier.

| Endpoint | Contenu |
|---|---|
| `GET /matches` | Matchs à venir avec probabilités, xG, score le plus probable, plus de 2,5 buts |
| `GET /live` | Matchs en cours, probabilité en direct |
| `GET /tables` | Classement probable de fin de saison |
| `GET /teams/{id}` | Forme, prochains matchs, projection |
| `GET /reliability` | Historique public de fiabilité |
| `GET /articles` | Avant-matchs complets en français et en anglais, avec image |

👉 [Documentation et accès anticipé](https://aifootpredictor.com/fr/api/?src=github)

---

## Questions fréquentes

<details>
<summary><b>AI Football Predictor est-il gratuit ?</b></summary>

Oui. Le site, la web app, la mini app Telegram et le widget sont gratuits.
</details>

<details>
<summary><b>Est-ce un conseil de pari ?</b></summary>

Non. Ce sont des estimations statistiques à titre d'information. Aucune garantie de résultat. Interdit aux moins de 18 ans. Jouer comporte des risques : appelez le 09 74 75 13 13 (appel non surtaxé).
</details>

<details>
<summary><b>D'où viennent les données ?</b></summary>

Les résultats, calendriers et compositions viennent d'un fournisseur de données sportives. Les probabilités, buts attendus, classements simulés et articles sont calculés par notre propre modèle.
</details>

<details>
<summary><b>Comment installer l'appli sur mon téléphone ?</b></summary>

Ouvrez le site dans Safari (iPhone) ou Chrome (Android), puis « Sur l'écran d'accueil ». Ou ouvrez la mini app directement dans Telegram.
</details>

<details>
<summary><b>Pourquoi le résultat le plus probable n'arrive pas toujours ?</b></summary>

Parce qu'une probabilité de 55 % veut dire que l'autre issue arrive 45 % du temps. On juge un modèle sur des centaines de matchs, pas sur un seul : c'est pour ça que l'historique est public.
</details>

---

<div align="center">

**AI Football Predictor** · by [@jeremstyke](https://t.me/jeremstyke)

<sub>football predictions · soccer predictions · AI football predictions · match probabilities · expected goals · xG · Poisson model · 1X2 · over 2.5 goals · BTTS · Premier League predictions · Champions League predictions · LaLiga predictions · Serie A predictions · Bundesliga predictions · Ligue 1 · pronostics foot · probabilités foot · prédictions football IA</sub>

</div>
