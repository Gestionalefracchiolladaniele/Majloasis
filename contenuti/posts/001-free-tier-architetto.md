---
numero: 001
tema: Il free tier come miglior architetto
formato: C (ragionamento da builder)
voce: tecnico diretto
stato: bozza (da pubblicare)
data_pubblicazione:
immagine: opzionale (screenshot codice batching/backoff) oppure solo testo
---

# Post 001 — Il free tier come miglior architetto

## Bozza v1

Il free tier è stato il miglior architetto del mio ultimo progetto.

Budget: $0. Vincolo: l'API AI mi dava 20 richieste al minuto, non una di più.

Con un budget illimitato avrei fatto la cosa pigra: una chiamata al modello per ogni elemento da valutare. 100 elementi = 100 chiamate. Funziona, ma è spreco puro.

Il limite mi ha costretto a pensare. Risultato:

→ Batching: raggruppo 20 elementi in una sola chiamata. 100 elementi = 5 chiamate invece di 100.
→ Backoff intelligente: quando arriva il 429, non riprovo a caso — leggo il retryDelay che il server mi dice e aspetto esattamente quello.
→ Caching di ciò che non cambia: il contesto fisso lo calcolo una volta e lo riuso, non lo rigenero a ogni giro.

Stesso risultato. Una frazione delle chiamate. Costo: zero.

La verità che ho imparato: un budget illimitato ti fa scrivere codice pigro. Un vincolo ti costringe a capire davvero il sistema.

Il free tier non è una limitazione. È un product manager che non ti lascia barare.

---

## Note di costruzione
- Hook controintuitivo in riga 1 (free tier = architetto).
- Una sola idea, 3 prove concrete (batching / backoff / caching).
- Chiusura memorabile ("product manager che non ti lascia barare").
- Zero menzione di "scraping LinkedIn" → safe, suona come AI engineering sotto vincoli.
- Immagine: opzione A (screenshot codice) o B (solo testo). NO screenshot dashboard.
