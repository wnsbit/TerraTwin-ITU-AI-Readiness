/* ============================================================
   TerraTwin KB module — the farm-operations feature set
   So Farmy can answer questions about the new screens too.
   ============================================================ */
(function () {
  const E = (k, title, a) => ({ k, title, a });
  KB.corpus.push(
    E(["my plants", "add a plant", "plant register", "schedule irrigation", "irrigation reminder", "fertiliser reminder"],
      "The plant register",
      "My plants is where you register what is actually growing on your land: a name, the crop, the plot, the planting date, and how often it should be irrigated and fertilised. From that the app builds a live schedule — every plant shows when its next irrigation and fertilisation falls due, overdue items turn red, and pressing Watered or Fertilised restarts the clock. Sensible starting intervals are filled in for you per crop and you can change them."),
    E(["plant doctor", "camera", "scan plant", "diagnose plant", "photo diagnosis", "what is wrong with my plant"],
      "The Plant doctor camera",
      "Plant doctor reads a photo of a plant and returns the species, the life stage, a health score out of 100, a diagnosis and the steps to take this week. With a Google Gemini key set in Settings it uses Gemini vision. With no key it falls back to an on-device colour analysis that measures how much of the leaf area is healthy green against yellowing and necrotic tissue — coarser, but it runs with no network. Scans are saved and can be attached to a registered plant so you can watch it improve week by week."),
    E(["weather alert", "forecast", "rain", "heat warning", "weather swing", "temperature swing"],
      "Weather alerts",
      "Weather watch pulls a seven-day forecast for your part of Jazan and reads it against what you have planted. It raises alerts for heat stress above 42 °C, sharp day-to-day temperature swings, incoming rain worth skipping an irrigation for, humid spells that build fungal pressure, strong wind, and cold highland nights. Each alert carries the action, not just the number — and one button pushes your irrigation dates past a rain event, counting the water saved."),
    E(["forum", "community", "voice note", "ask other farmers"],
      "The farmers' forum",
      "The forum is where growers in the region ask each other. Posts can be text, a photo of the problem, or a recorded voice note — which matters, because plenty of experienced farmers would rather talk than type. Posts are tagged by subject, can be searched and filtered, and anyone can reply. A diagnosis from the Plant doctor can be pushed straight into a draft post with the photo attached."),
    E(["market", "shop", "buy seeds", "sell", "listing", "services"],
      "The market",
      "The market lists seed, seedlings, plants, inputs and farm services priced in riyals, by category, with each seller's own contact. Anyone with an account can publish a listing. Requesting an item records it under your requests with the seller's number — nothing is charged inside the app; the transaction stays between the two of you."),
    E(["seasons", "planting calendar", "when to plant", "tihama calendar"],
      "The season calendar",
      "The Seasons screen shows the current Tihama season and what is worth sowing in it, alongside every reminder you have — plant schedules and your own notes — ordered by what is closest to falling behind. Highland terraces at Fifa and Al-Reeth run about two to three weeks behind the coast.")
  );
})();
