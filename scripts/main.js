import { System, system, world} from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData  } from "@minecraft/server-ui"


const version_info = {
  name: "Level = Border",
  version: "v.3.0.1",
  build: "B006",
  release_type: 0, // 0 = Development version (with debug); 1 = Beta version; 2 = Stable version
  unix: 1760609911,
  uuid: "224e31a2-8c9c-451c-a1af-d92ec41d0d08",
  changelog: {
    // new_features
    new_features: [
    ],
    // general_changes
    general_changes: [
      "Added a Message if the Timer is not correctly installed",
      "Fixed spelling mistakes"
    ],
    // bug_fixes
    bug_fixes: [
      "Border teleportation should be more reliable"
    ]
  }
}

const links = [
  {name: "§l§5Github:§r", link: "github.com/TheFelixLive/Level-Boder"},
  {name: "§l§aMcpedl:§r", link: "mcpedl.com/level-boder"},
]

console.log("Hello from " + version_info.name + " - "+version_info.version+" ("+version_info.build+") - Further debugging is "+ (version_info.release_type == 0? "enabled" : "disabled" ) + " by the version")



/*------------------------
  Challenge Communication System V1
-------------------------*/

// Status
let challenge_running = false
let is_initialized = false

system.afterEvents.scriptEventReceive.subscribe(async event=> {
   if (event.id === "ccs:data") {
    let player = event.sourceEntity, data, scoreboard = world.scoreboard.getObjective("ccs_data")

    // Reads data from the scoreboard
    if (scoreboard) {
      try {
        data = JSON.parse(scoreboard.getParticipants()[0].displayName)
      } catch (e) {
        print("Wrong formated data: "+scoreboard.getParticipants()[0]) // Scoreboard IS available but contains garbisch
        world.scoreboard.removeObjective("ccs_data")
        return -1
      }
    } else {
      // print("No Scoreboard!")
      return -1 // Scoreboard is not available: happens when an addon has already processed the request e.g. "open main menu"
    }


    // Initializing
    if (data.event == "ccs_initializing") {
      scoreboard.removeParticipant(JSON.stringify(data))

      data.data.push({
        uuid: version_info.uuid,
        name: version_info.name,
        icon: "textures/items/experience_bottle",
        config_available: false,
        about_available: true,
        incompatibilities: [""], // List of UUIDs which are incompatible with this challenge
      })

      is_initialized = true

      // Saves data in to the scoreboard
      scoreboard.setScore(JSON.stringify(data), 1)
    }

    if (!is_initialized) return -1;

    if (data.event == "ccs_about" && data.data.target == version_info.uuid) {
      world.scoreboard.removeObjective("ccs_data")
      dictionary_about(player)
    }

    // Will start the challenge running scripts
    if (data.event == "ccs_start" && data.data.target.includes(version_info.uuid)) {
      scoreboard.removeParticipant(JSON.stringify(data))

      // Removes itself from the target list
      data.data.target = data.data.target.filter(uuid => uuid !== version_info.uuid);

      // Saves data in to the scoreboard
      if (data.data.target.length == 0) world.scoreboard.removeObjective("ccs_data")
      else scoreboard.setScore(JSON.stringify(data), 1)

      challenge_running = true
    }

    // Will stop the challenge running scripts
    if (data.event == "ccs_stop" && data.data.target == version_info.uuid) {
      scoreboard.removeParticipant(JSON.stringify(data))

      // Removes itself from the target list
      data.data.target = data.data.target.filter(uuid => uuid !== version_info.uuid);

      // Saves data in to the scoreboard
      if (data.data.target.length == 0) world.scoreboard.removeObjective("ccs_data")
      else scoreboard.setScore(JSON.stringify(data), 1)

      challenge_running = false
    }
   }
})

/*------------------------
 Helper functions
-------------------------*/

function print(input) {
  if (version_info.release_type === 0) {
    console.log(version_info.name + " - " + JSON.stringify(input))
  }
}

// Time
function getRelativeTime(diff) {
  let seconds = diff;
  let minutes = Math.floor(seconds / 60);
  let hours = Math.floor(minutes / 60);
  let days = Math.floor(hours / 24);
  let months = Math.floor(days / 30);
  let years = Math.floor(days / 365);

  if (years > 0) {
    return `${years} year${years > 1 ? 's' : ''}`;
  }
  if (months > 0) {
    return `${months} month${months > 1 ? 's' : ''}`;
  }
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  return `a few seconds`;
}

function convertUnixToDate(unixSeconds, utcOffset) {
  const date = new Date(unixSeconds*1000);
  const localDate = new Date(date.getTime() + utcOffset * 60 * 60 * 1000);

  // Format the date (YYYY-MM-DD HH:MM:SS)
  const year = localDate.getUTCFullYear();
  const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(localDate.getUTCDate()).padStart(2, '0');
  const hours = String(localDate.getUTCHours()).padStart(2, '0');
  const minutes = String(localDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(localDate.getUTCSeconds()).padStart(2, '0');

  return {
    day: day,
    month: month,
    year: year,
    hours: hours,
    minutes: minutes,
    seconds: seconds,
    utcOffset: utcOffset
  };
}

// Internet API
async function fetchViaInternetAPI(url, timeoutMs = 20) {
  await system.waitTicks(1); // If mm_host gets initialisiert later

  // Wait until the line (the scoreboard) is free
  let objective = world.scoreboard.getObjective("mm_data");

  if (objective !== undefined) {
    await waitForNoObjective("mm_data");
  }

  world.scoreboard.addObjective("mm_data");
  objective = world.scoreboard.getObjective("mm_data");

  return new Promise((resolve, reject) => {
    try {
      // Payload bauen
      const payload = {
        event: "internet_api",
        data: {
          source: version_info.uuid,
          url: url
        }
      };

      // In Scoreboard schreiben und Event auslösen
      objective.setScore(JSON.stringify(payload), 1);
      world.getDimension("overworld").runCommand("scriptevent multiple_menu:data");

      // State für Cleanup
      let finished = false;
      let timerHandle = null;

      // Helper: safe cleanup (einmalig)
      const cleanup = () => {
        if (finished) return;
        finished = true;
        try { world.scoreboard.removeObjective("mm_data"); } catch (_) {}
        try { system.afterEvents.scriptEventReceive.unsubscribe(subscription); } catch (_) {}
        // Timer stoppen (versuche verschiedene API-Namen)
        try {
          if (timerHandle !== null) {
            if (typeof system.runTimeout === "function") system.runTimeout(timerHandle);
            else if (typeof system.runInterval === "function") system.runInterval(timerHandle);
            else if (typeof clearTimeout === "function") clearTimeout(timerHandle);
            else if (typeof clearInterval === "function") clearInterval(timerHandle);
          }
        } catch (_) {}
      };

      // Subscription für scriptevent
      const subscription = system.afterEvents.scriptEventReceive.subscribe(event => {
        if (event.id !== "multiple_menu:data") return;

        try {
          const board = world.scoreboard.getObjective("mm_data");
          if (!board) {
            // wurde möglicherweise bereits entfernt
            cleanup();
            return reject(new Error("Scoreboard mm_data nicht vorhanden nach Event."));
          }

          const participants = board.getParticipants();
          if (!participants || participants.length === 0) {
            // noch keine Daten — weiterwarten
            return;
          }

          const raw = participants[0].displayName;
          let data;
          try {
            data = JSON.parse(raw);
          } catch (e) {
            cleanup();
            return reject(new Error("Falsches Format im Scoreboard: " + e));
          }

          if (data.event === "internet_api" && data.data && data.data.target === version_info.uuid) {
            try {
              const answer = JSON.parse(data.data.answer);
              cleanup();
              return resolve(answer);
            } catch (e) {
              cleanup();
              return reject(new Error("Antwort konnte nicht als JSON geparst werden: " + e));
            }
          }
          // sonst: nicht für uns bestimmt -> ignorieren
        } catch (e) {
          cleanup();
          return reject(e);
        }
      });

      // Timeout einrichten: system.runTimeout bevorzugen, sonst runInterval-Fallback
      if (typeof system.runTimeout === "function") {
        timerHandle = system.runTimeout(() => {
          if (finished) return;
          cleanup();
          return reject(new Error("Timeout: keine Antwort von der Internet-API innerhalb " + timeoutMs + " ms"));
        }, timeoutMs);
      } else if (typeof system.runInterval === "function") {
        const start = Date.now();
        // poll alle 100ms auf Timeout
        timerHandle = system.runInterval(() => {
          if (finished) return;
          if (Date.now() - start >= timeoutMs) {
            cleanup();
            return reject(new Error("Timeout: keine Antwort von der Internet-API innerhalb " + timeoutMs + " ms"));
          }
        }, 100);
      } else {
        // Kein Timer verfügbar -> sofort aufräumen & Fehler
        cleanup();
        return reject(new Error("Keine Timer-Funktionen verfügbar (kein runTimeout/runInterval)."));
      }

    } catch (err) {
      try { world.scoreboard.removeObjective("mm_data"); } catch (_) {}
      return reject(err);
    }
  });
}

async function waitForNoObjective(name) {
  let obj = world.scoreboard.getObjective(name);
  while (obj) {
    // kleine Pause (z. B. 100ms), um den Server nicht zu blockieren
    await new Promise(resolve => system.runTimeout(resolve, 5)); // 5 Ticks warten
    obj = world.scoreboard.getObjective(name);
  }
}

// Update data (github)
let github_data

system.run(() => {
  update_github_data()
});

async function update_github_data() {
  try {
    fetchViaInternetAPI("https://api.github.com/repos/TheFelixLive/Level=Boader/releases")
    .then(result => {
      print("API-Antwort erhalten");

      github_data = result.map(release => {
        const totalDownloads = release.assets?.reduce((sum, asset) => sum + (asset.download_count || 0), 0) || 0;
        return {
          tag: release.tag_name,
          name: release.name,
          prerelease: release.prerelease,
          published_at: release.published_at,
          body: release.body,
          download_count: totalDownloads
        };
      });

    })
    .catch(err => {
      print("Fehler beim Abruf: " + err);
    });

  } catch (e) {
  }
}

function compareVersions(version1, version2) {
  if (!version1 || !version2) return 0;

  // Entfernt 'v.' oder 'V.' am Anfang
  version1 = version1.replace(/^v\./i, '').trim();
  version2 = version2.replace(/^v\./i, '').trim();

  // Extrahiere Beta-Nummer aus "_1" oder " Beta 1"
  function extractBeta(version) {
    const betaMatch = version.match(/^(.*?)\s*(?:_|\sBeta\s*)(\d+)$/i);
    if (betaMatch) {
      return {
        base: betaMatch[1].trim(),
        beta: parseInt(betaMatch[2], 10)
      };
    }
    return {
      base: version,
      beta: null
    };
  }

  const v1 = extractBeta(version1);
  const v2 = extractBeta(version2);

  const v1Parts = v1.base.split('.').map(Number);
  const v2Parts = v2.base.split('.').map(Number);

  // Vergleicht Major, Minor, Patch
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const num1 = v1Parts[i] || 0;
    const num2 = v2Parts[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  // Wenn gleich, vergleiche Beta
  if (v1.beta !== null && v2.beta === null) return -1; // Beta < Vollversion
  if (v1.beta === null && v2.beta !== null) return 1;  // Vollversion > Beta

  if (v1.beta !== null && v2.beta !== null) {
    if (v1.beta > v2.beta) return 1;
    if (v1.beta < v2.beta) return -1;
  }

  return 0;
}

function spawnBorderParticles(player, level) {
  const px = player.location.x;
  const py = player.location.y;
  const pz = player.location.z;
  const radius = 10;

  // Bereich 5 Blöcke über und unter dem Spieler
  const yStart = Math.floor(py - 2);
  const yEnd   = Math.floor(py + 4);

  // X-Ränder bei x = ±level
  for (const borderX of [-level, level]) {
    if (Math.abs(px - borderX) <= radius) {
      const zStart = Math.max(-level, Math.floor(pz - radius));
      const zEnd   = Math.min(level, Math.floor(pz + radius));
      for (let z = zStart; z <= zEnd; z++) {
        for (let y = yStart; y <= yEnd; y++) {
          try {
            player.spawnParticle("minecraft:basic_portal_particle", { x: borderX, y: y, z: z });
          } catch (e) {
          }
        }
      }
    }
  }

  // Z-Ränder bei z = ±level
  for (const borderZ of [-level, level]) {
    if (Math.abs(pz - borderZ) <= radius) {
      const xStart = Math.max(-level, Math.floor(px - radius));
      const xEnd   = Math.min(level, Math.floor(px + radius));
      for (let x = xStart; x <= xEnd; x++) {
        for (let y = yStart; y <= yEnd; y++) {
          try {
            player.spawnParticle("minecraft:basic_portal_particle", { x: x, y: y, z: borderZ });
          } catch (e) {
          }
        }
      }
    }
  }
}

/*------------------------
 Welcome Message
-------------------------*/

world.afterEvents.playerSpawn.subscribe(async (eventData) => {
  const { player, initialSpawn } = eventData;
  if (!initialSpawn) return -1

  await system.waitTicks(40); // Wait for the player to be fully joined

  if (version_info.release_type !== 2 && player.playerPermissionLevel === 2) {
    player.sendMessage("§l§7[§f" + ("System") + "§7]§r "+ player.name +" how is your experiences with "+ version_info.version +"? Does it meet your expectations? Would you like to change something and if so, what? Do you have a suggestion for a new feature? Share it at §l"+links[0].link)
    player.playSound("random.pop")
  }
});



/*------------------------
 Dictionary
-------------------------*/

function dictionary_about(player) {
  let form = new ActionFormData()
  let actions = []

  let build_date = convertUnixToDate(version_info.unix, 0);
  form.title("About")

  form.body("§lGeneral")
  form.label(
    "Name: " + version_info.name+ "\n"+
    "UUID: "+ version_info.uuid
  )

  form.label("§lVersion")
  form.label(
    "Version: " + version_info.version + "\n" +
    "Build: " + version_info.build + "\n" +
    "Release type: " + ["dev", "preview", "stable"][version_info.release_type] + "\n" +
    "Build date: " + (getRelativeTime(Math.floor(Date.now() / 1000) - version_info.unix, player) + " ago") + "\n" +
    "Status: " + (github_data? (compareVersions((version_info.release_type === 2 ? github_data.find(r => !r.prerelease)?.tag : github_data[0]?.tag), version_info.version) !== 1? "§aLatest version" : "§6Update available!"): "§cFailed to fetch!")
  );

  form.label("§7© "+ (build_date.year > 2025 ? "2025 - " + build_date.year : build_date.year ) + " TheFelixLive. Licensed under the MIT License.")

  if (version_info.changelog.new_features.length > 0 || version_info.changelog.general_changes.length > 0 || version_info.changelog.bug_fixes.length > 0) {
    form.button("§9Changelog"+(github_data?"s":""));
    actions.push(() => {
      github_data? dictionary_about_changelog(player) : dictionary_about_changelog_legacy(player, build_date)
    });
  }

  form.button("§3Contact");
  actions.push(() => {
    dictionary_contact(player, build_date)
  });

  form.divider()
  form.button("");
  actions.push(() => {
    world.scoreboard.addObjective("ccs_data");
    world.scoreboard.getObjective("ccs_data").setScore(JSON.stringify({event: "ccs_about", data:{target: "main"}}), 1);
    player.runCommand("scriptevent ccs:data");
  });

  form.show(player).then((response) => {
    if (response.selection == undefined ) {
      world.scoreboard.addObjective("ccs_data");
      world.scoreboard.getObjective("ccs_data").setScore(JSON.stringify({event: "ccs_close_menu", data:{target: "main"}}), 1);
      player.runCommand("scriptevent ccs:data");
    }
    if (response.selection !== undefined && actions[response.selection]) {
      actions[response.selection]();
    }
  });
}

function dictionary_about_changelog(player) {
  const form = new ActionFormData();
  const actions = [];

  // ---- 1) Hilfsdaten ----------------------------------------------------
  const installed   = version_info.version;        // z.B. "v1.5.0"
  const buildName   = version_info.build;          // z.B. "B123"
  const installDate = version_info.unix;           // z.B. "1700000000"

  // ---- 3) Neue Instanzen finden -----------------------------------------
  const latest_stable = github_data.find(r => !r.prerelease);
  let   latest_beta   = github_data.find(r => r.prerelease);

  // ---- 4) Beta-Versions-Filter (nach release_type) --------------------
  if (version_info.release_type === 2) { // „nur Beta zulassen“
    if (latest_beta && latest_stable) {
      const isBetaNewer = compareVersions(latest_beta.name, latest_stable.name) > 0;
      if (isBetaNewer) {
        // Nur die neueste Beta behalten
        github_data = github_data.filter(r => r === latest_beta || !r.prerelease);
      } else {
        // Stable neuer oder gleich → Betas entfernen
        github_data = github_data.filter(r => !r.prerelease);
        latest_beta = undefined;
      }
    } else {
      // Sicherheit: Alle Betas entfernen
      github_data = github_data.filter(r => !r.prerelease);
      latest_beta = undefined;
    }
  } else {
    // Wenn Stable neuer als Beta ist → Beta Label unterdrücken
    if (latest_beta && latest_stable) {
      const isStableNewer = compareVersions(latest_stable.name, latest_beta.name) > 0;
      if (isStableNewer) {
        latest_beta = undefined; // Kein Beta-Label später anzeigen
      }
    }
  }


  // ---- 5) Alle Einträge, inkl. eventuell fehlenden Installations‑Eintrag --
  const allData = [...github_data];

  // Prüfen, ob die installierte Version überhaupt in der Liste vorkommt
  const isInstalledListed = github_data.some(r => r.name === installed);
  if (!isInstalledListed) {
    // Dummy‑Objekt – so sieht es aus wie ein reguläres GitHub‑Release
    allData.push({
      name:        installed,
      published_at: installDate,
      prerelease:  false,          // wichtig, damit das Label nicht „(latest beta)“ bekommt
    });
  }

  // Sortieren (nach Version)
  allData.sort((a, b) => compareVersions(b.name, a.name));

  // ---- 6) UI bauen ----------------------------------------------------
  form.title("About");
  form.body("Select a version");

  allData.forEach(r => {
    // Prüfen, ob r.published_at schon Unix-Sekunden ist
    const publishedUnix = (typeof r.published_at === 'number' && r.published_at < 1e12)
      ? r.published_at // schon in Sekunden
      : Math.floor(new Date(r.published_at).getTime() / 1000); // in Sekunden umrechnen

    let label;
    let build_date = convertUnixToDate(publishedUnix, 0);

    let build_text = (
      getRelativeTime(Math.floor(Date.now() / 1000) - publishedUnix, player) + " ago"
    );

    if (r === latest_beta && r.name === installed) {
      label = `${r.name} (${buildName})\n${build_text} §9(latest beta)`;
    } else {
      label = `${r.name}\n${build_text}`;

      if (r === latest_stable) {
        label += ' §a(latest version)';
      } else if (r === latest_beta) {
        label += ' §9(latest beta)';
      } else if (r.name === installed) {
        label += ' §6(installed version)';
      }
    }

    form.button(label);

    actions.push(() => {
      dictionary_about_changelog_view(player, r);
    });
  });


  // ---- 7) Footer‑Button -------------------------------------------------
  form.divider();
  form.button("");
  actions.push(() => {
    dictionary_about(player);
  });

  // ---- 8) Anzeigen -----------------------------------------------------
  form.show(player).then(response => {
    if (response.selection === undefined) {
      world.scoreboard.addObjective("ccs_data");
      world.scoreboard.getObjective("ccs_data").setScore(JSON.stringify({event: "ccs_close_menu", data:{target: "main"}}), 1);
      player.runCommand("scriptevent ccs:data");
    }
    if (actions[response.selection]) actions[response.selection]();
  });
}

function dictionary_about_changelog_view(player, version) {
  const publishedUnix = (typeof version.published_at === 'number' && version.published_at < 1e12)
  ? version.published_at // schon in Sekunden
  : Math.floor(new Date(version.published_at).getTime() / 1000);

  let build_date = convertUnixToDate(publishedUnix, 0);

  if (version.name == version_info.version) return dictionary_about_changelog_legacy(player, build_date)
  const form = new ActionFormData().title("Changelog - " + version.name);

  // TODO: Markdown support
  form.body(markdownToMinecraft(version.body))


  const dateStr = `${build_date.day}.${build_date.month}.${build_date.year}`;
  const relative = getRelativeTime(Math.floor(Date.now() / 1000) - publishedUnix);
  form.label(`§7As of ${dateStr} (${relative} ago)`);
  form.button("");

  form.show(player).then(res => {
    if (res.selection === 0) dictionary_about_changelog(player);
    else {
      world.scoreboard.addObjective("ccs_data");
      world.scoreboard.getObjective("ccs_data").setScore(JSON.stringify({event: "ccs_close_menu", data:{target: "main"}}), 1);
      player.runCommand("scriptevent ccs:data");
    }
  });
}

function dictionary_about_changelog_legacy(player, build_date) {
  const { new_features, general_changes, bug_fixes } = version_info.changelog;
  const { unix } = version_info
  const sections = [
    { title: "§l§bNew Features§r", items: new_features },
    { title: "§l§aGeneral Changes§r", items: general_changes },
    { title: "§l§cBug Fixes§r", items: bug_fixes }
  ];

  const form = new ActionFormData().title("Changelog - " + version_info.version);

  let bodySet = false;
  for (let i = 0; i < sections.length; i++) {
    const { title, items } = sections[i];
    if (items.length === 0) continue;

    const content = title + "\n\n" + items.map(i => `- ${i}`).join("\n\n");

    if (!bodySet) {
      form.body(content);
      bodySet = true;
    } else {
      form.label(content);
    }

    // Add divider if there's at least one more section with items
    if (sections.slice(i + 1).some(s => s.items.length > 0)) {
      form.divider();
    }
  }

  const dateStr = `${build_date.day}.${build_date.month}.${build_date.year}`;
  const relative = getRelativeTime(Math.floor(Date.now() / 1000) - unix);
  form.label(`§7As of ${dateStr} (${relative} ago)`);
  form.button("");

  form.show(player).then(res => {
    if (res.selection === 0) github_data? dictionary_about_changelog(player) : dictionary_about(player);
    else {
      world.scoreboard.addObjective("ccs_data");
      world.scoreboard.getObjective("ccs_data").setScore(JSON.stringify({event: "ccs_close_menu", data:{target: "main"}}), 1);
      player.runCommand("scriptevent ccs:data");
    }
  });
}

function dictionary_contact(player) {
  let form = new ActionFormData()

  let actions = []
  form.title("Contact")
  form.body("If you need want to report a bug, need help, or have suggestions to improvements to the project, you can reach me via these platforms:\n");

  for (const entry of links) {
    if (entry !== links[0]) form.divider()
    form.label(`${entry.name}\n${entry.link}`);
  }

  form.divider()
  form.button("");
  actions.push(() => {
    dictionary_about(player)
  });

  form.show(player).then((response) => {
    if (response.selection == undefined ) {
      world.scoreboard.addObjective("ccs_data");
      world.scoreboard.getObjective("ccs_data").setScore(JSON.stringify({event: "ccs_close_menu", data:{target: "main"}}), 1);
      player.runCommand("scriptevent ccs:data");
    }
    if (response.selection !== undefined && actions[response.selection]) {
      actions[response.selection]();
    }
  });
}

/*------------------------
 Update loop
-------------------------*/

async function update_loop() {
  let oldLevel = 0;
  await system.waitTicks(3);
  while (true) {

    for (const player of world.getAllPlayers()) {

      if (!is_initialized) {
        player.sendMessage('§l§4[§cError§4]§r The timer is not installed correctly! Check that the timer is active and has the correct CCS version.');
        player.playSound("random.pop")
        return -1;
      }

      const x = player.location.x;
      const z = player.location.z;

      let level = Math.max(player.level, 0.5);
      let reducedLevel = 0;
      let xp_needed = player.totalXpNeededForNextLevel;

      reducedLevel = oldLevel - level;
      xp_needed = xp_needed - player.xpEarnedAtCurrentLevel;


      let newX = x;
      let newZ = z;
      let outsideBorder = false;

      if (x > level) {
          newX = level;
          outsideBorder = true;
      } else if (x < -level) {
          newX = -level;
          outsideBorder = true;
      }

      if (z > level) {
          newZ = level;
          outsideBorder = true;
      } else if (z < -level) {
          newZ = -level;
          outsideBorder = true;
      }

      // Out of borader message + teleport
      if (challenge_running) {
        if (outsideBorder && level < 24791) {
          player.teleport({ x: newX, y: player.location.y, z: newZ });

          try {
            if (!(player.dimension.getBlock({ x: newX, y: player.location.y, z: newZ }).isAir && player.dimension.getBlock({ x: newX, y: player.location.y+1, z: newZ }).isAir)) {
              player.teleport({ x: newX, y: (player.dimension.getTopmostBlock({x: newX, z: newZ}).y + 1), z: newZ });
            }
          } catch(e) {
            player.teleport({ x: newX, y: (player.dimension.getTopmostBlock({x: newX, z: newZ}).y + 1), z: newZ });
          }




        }

        // particle
        if (level < 24791) {
          spawnBorderParticles(player, level);
        }

        // Increas or decrese Boader message
        if (level !== oldLevel) {
            if (level > oldLevel && level !== 24791) {
                player.runCommand('playsound random.orb @a');
                player.sendMessage('§l§c[§bWorld Border§c]§r The world border expant to §l§a'+ level +' Blocks§r!');
            }

            if (level < oldLevel && level !== 24791) {
                player.runCommand('playsound note.bassattack @a');

                player.sendMessage(
                  `§l§c[§bWorld Border§c]§r The world border reduced by §l§a${reducedLevel} Block${reducedLevel === 1 ? '' : 's'}§r! Now it is §l§a${level} Blocks§r!`
                );

            }

            if (level == 24791) {
                player.runCommand('playsound random.orb @a');
                player.sendMessage('§l§c[§bWorld Border§c]§r The world border is turned off because you have reached the maximum level of §l§a'+ level +'§r!');
            }

            oldLevel = level;
        }
      }
    }

    await system.waitTicks(1);
  }
}

system.run(() => update_loop());