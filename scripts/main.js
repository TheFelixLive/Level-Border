import { system, world} from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData  } from "@minecraft/server-ui"


const version_info = {
  name: "Level = Border",
  version: "v.3.1.0",
  build: "B007",
  release_type: 0, // 0 = Development version (with debug); 1 = Beta version; 2 = Stable version
  unix: 1760717264,
  uuid: "224e31a2-8c9c-451c-a1af-d92ec41d0d08",
  changelog: {
    // new_features
    new_features: [
      "The boarder particle effect can now be adjusted",
      "One boarder for all players can now be adjusted"
    ],
    // general_changes
    general_changes: [
      "Added Support for CCS V2"
    ],
    // bug_fixes
    bug_fixes: [
      "Fixed online Changelog",
      "Fixed a critical bug that prevented multiplayer",
      "Border teleportation should be more reliable",
    ]
  }
}

const links = [
  {name: "§l§5Github:§r", link: "github.com/TheFelixLive/Level-Boder"},
  {name: "§l§8Curseforge:§r", link: "curseforge.com/projects/1365111"},
  {name: "§l§aMcpedl:§r", link: "mcpedl.com/level-boder"},
]

console.log("Hello from " + version_info.name + " - "+version_info.version+" ("+version_info.build+") - Further debugging is "+ (version_info.release_type == 0? "enabled" : "disabled" ) + " by the version")



/*------------------------
  Challenge Communication System V2
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
    if (data.event == "ccs_initializing_v2") {
      scoreboard.removeParticipant(JSON.stringify(data))

      data.data.push({
        uuid: version_info.uuid,
        name: version_info.name,
        icon: "textures/items/experience_bottle",
        config_available: true,
        about_available: true,
        incompatibilities: [], // List of UUIDs which are incompatible with this challenge
      })

      is_initialized = true

      // Saves data in to the scoreboard
      scoreboard.setScore(JSON.stringify(data), 1)
    }

    if (!is_initialized) return -1;

    // Will open the configuration menu of the challenge
    if (data.event == "ccs_config" && data.data.target == version_info.uuid) {
      world.scoreboard.removeObjective("ccs_data")
      config(player)
    }

    if (data.event == "ccs_about" && data.data.target == version_info.uuid) {
      world.scoreboard.removeObjective("ccs_data")
      dictionary_about(player)
    }

    // Will start the challenge running scripts
    if ((data.event == "ccs_start" || data.event == "ccs_resume") && data.data.target.includes(version_info.uuid)) {
      scoreboard.removeParticipant(JSON.stringify(data))

      // Removes itself from the target list
      data.data.target = data.data.target.filter(uuid => uuid !== version_info.uuid);

      // Saves data in to the scoreboard
      if (data.data.target.length == 0) world.scoreboard.removeObjective("ccs_data")
      else scoreboard.setScore(JSON.stringify(data), 1)

      challenge_running = true
    }

    // Will stop the challenge running scripts
    if ((data.event == "ccs_stop" || data.event == "ccs_pause") && data.data.target == version_info.uuid) {
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
 Save Data
-------------------------*/

// Creates or Updates Save Data if not present
system.run(() => {
  let save_data = load_save_data();

  const default_save_data_structure = {border_effects_index: 0, one_boarder: true};

  if (!save_data) {
      save_data = [default_save_data_structure];
      print("Creating save_data...");
  } else {
      let data_entry = save_data[0];
      let changes_made = false;

      function merge_defaults(target, defaults) {
          for (const key in defaults) {
              if (defaults.hasOwnProperty(key)) {
                  if (!target.hasOwnProperty(key)) {
                      target[key] = defaults[key];
                      changes_made = true;
                  } else if (typeof defaults[key] === 'object' && defaults[key] !== null && !Array.isArray(defaults[key])) {
                      if (typeof target[key] !== 'object' || target[key] === null || Array.isArray(target[key])) {
                          target[key] = defaults[key];
                          changes_made = true;
                      } else {
                          merge_defaults(target[key], defaults[key]);
                      }
                  }
              }
          }
      }

      merge_defaults(data_entry, default_save_data_structure);
      if (!Array.isArray(save_data) || save_data.length === 0) {
          save_data = [data_entry];
          changes_made = true;
      } else {
          save_data[0] = data_entry;
      }

      if (changes_made) {
          print("Missing save_data attributes found and added.");
      }
  }

  update_save_data(save_data);
})

// Load & Save Save data
function load_save_data() {
    let rawData = world.getDynamicProperty("l=b:save_data");

    if (!rawData) {
        return;
    }

    return JSON.parse(rawData);
}

function update_save_data(input) {
  world.setDynamicProperty("l=b:save_data", JSON.stringify(input))
};

/*------------------------
 Helper functions
-------------------------*/

function print(input) {
  if (version_info.release_type === 0) {
    console.log(version_info.name + " - " + JSON.stringify(input))
  }
}

function markdownToMinecraft(md) {
  if (typeof md !== 'string') return '';

  // normalize newlines
  md = md.replace(/\r\n?/g, '\n');

  const UNSUPPORTED_MSG = '§o§7Tabelles are not supported! Visit GitHub for this.';

  // helper: map admonition type -> minecraft color code (choose sensible defaults)
  function admonColor(type) {
    const t = (type || '').toLowerCase();
    if (['caution', 'warning', 'danger', 'important'].includes(t)) return '§c'; // red
    if (['note', 'info', 'tip', 'hint'].includes(t)) return '§b'; // aqua
    return '§e'; // fallback: yellow
  }

  // inline processor (handles code spans first, then bold/italic/strike, links/images, etc.)
  function processInline(text) {
    if (!text) return '';

    // tokenise code spans to avoid further processing inside them
    const tokens = [];
    text = text.replace(/(`+)([\s\S]*?)\1/g, (m, ticks, code) => {
      const safe = code.replace(/\n+/g, ' '); // inline code -> single line
      const repl = '§7' + safe + '§r';
      tokens.push(repl);
      return `__MD_TOKEN_${tokens.length - 1}__`;
    });

    // images -> unsupported (replace whole image with message)
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, () => UNSUPPORTED_MSG);

    // links -> keep link text only (no URL)
    text = text.replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '$1');

    // bold: **text** or __text__ -> §ltext§r
    text = text.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '§l$2§r');

    // italic: *text* or _text_ -> §otext§r
    // (do after bold so that **...** won't be partially matched)
    text = text.replace(/(\*|_)(?=\S)([\s\S]*?\S)\1/g, '§o$2§r');

    // strikethrough: ~~text~~ -> use italic+gray as fallback (no §m)
    text = text.replace(/~~([\s\S]*?)~~/g, '§o§7$1§r');

    // simple HTML tags or raw tags -> treat as unsupported (avoid exposing markup)
    if (/<\/?[a-z][\s\S]*?>/i.test(text)) return UNSUPPORTED_MSG;

    // restore code tokens
    text = text.replace(/__MD_TOKEN_(\d+)__/g, (m, idx) => tokens[Number(idx)] || '');

    return text;
  }

  // 1) Replace fenced code blocks (```...```) with unsupported message
  md = md.replace(/```[\s\S]*?```/g, () => UNSUPPORTED_MSG);

  // 2) Replace GitHub-style admonition blocks: ::: type\n...\n:::
  md = md.replace(/::: *([A-Za-z0-9_-]+)\s*\n([\s\S]*?)\n:::/gmi, (m, type, content) => {
    // flatten content lines, then process inline inside
    const inner = processInline(content.replace(/\n+/g, ' ').trim());
    const cap = type.charAt(0).toUpperCase() + type.slice(1);
    return `§l${admonColor(type)}${cap}: ${inner}§r`;
  });

  // now process line-by-line for tables / headings / lists / blockquotes / admonitions-as-blockquotes
  const lines = md.split('\n');
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // trim trailing CR/ spaces
    const raw = line;

    //  ---- detect table: a row with '|' and a following separator row like "| --- | --- |" or "---|---"
    const nextLine = lines[i + 1] || '';
    const isTableRow = /\|/.test(line);
    const nextIsSeparator = /^\s*\|?[:\-\s|]+$/.test(nextLine);
    if (isTableRow && nextIsSeparator) {
      // consume all contiguous table rows
      out.push(UNSUPPORTED_MSG);
      i++; // skip the separator
      while (i + 1 < lines.length && /\|/.test(lines[i + 1])) i++;
      continue;
    }

    //  ---- headings (#, ##, ###) -> §l + content + §r + \n
    const hMatch = line.match(/^(#{1,3})\s*(.*)$/);
    if (hMatch) {
      const content = hMatch[2].trim();
      out.push('§l' + processInline(content) + '§r\n');
      continue;
    }

    //  ---- GitHub-style single-line admonition in > or plain "Caution: ..." at line start
    const admonLineMatch = raw.match(/^\s*(?:>\s*)?(?:\*\*)?(Caution|Warning|Note|Tip|Important|Danger|Info)(?:\*\*)?:\s*(.+)$/i);
    if (admonLineMatch) {
      const type = admonLineMatch[1];
      const content = admonLineMatch[2].trim();
      out.push(`§l${admonColor(type)}${type}: ${processInline(content)}§r`);
      continue;
    }

    //  ---- blockquote lines starting with '>'
    if (/^\s*>/.test(line)) {
      const content = line.replace(/^\s*>+\s?/, '');
      out.push('§o' + processInline(content) + '§r');
      continue;
    }

    //  ---- images or html inline -> unsupported
    if (/^!\[.*\]\(.*\)/.test(line) || /<[^>]+>/.test(line)) {
      out.push(UNSUPPORTED_MSG);
      continue;
    }

    //  ---- unordered list (-, *, +) -> bullet + inline
    if (/^\s*[-*+]\s+/.test(line)) {
      const item = line.replace(/^\s*[-*+]\s+/, '');
      out.push('• ' + processInline(item));
      continue;
    }

    //  ---- ordered list (1. 2. ...) -> bullet as well
    if (/^\s*\d+\.\s+/.test(line)) {
      const item = line.replace(/^\s*\d+\.\s+/, '');
      out.push('• ' + processInline(item));
      continue;
    }

    //  ---- default: process inline formatting
    // empty line -> keep empty
    if (line.trim() === '') {
      out.push('');
      continue;
    }

    out.push(processInline(line));
  }

  // join with newline and return
  return out.join('\n');
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
    fetchViaInternetAPI("https://api.github.com/repos/TheFelixLive/Level-Boader/releases")
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

  let save_data = load_save_data()

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
            player.spawnParticle(border_effects_list[save_data[0].border_effects_index].id, { x: borderX, y: y, z: z });
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
            player.spawnParticle(border_effects_list[save_data[0].border_effects_index].id, { x: x, y: y, z: borderZ });
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
 Config Menu
-------------------------*/

let border_effects_list = [
  {name: "Portal", textures: "", id: "minecraft:basic_portal_particle"},
  {name: "Wind charged", id: "minecraft:wind_charged_ambient"},
]

function config(player) {
  let form = new ActionFormData()
  let actions = []
  let save_data = load_save_data()
  let effect = border_effects_list[save_data[0].border_effects_index]
  form.title("Config Menu")

  form.body("Select an Option!");


  if (effect.textures) {
    form.button("Border effects\n§9"+effect.name, effect.textures);
  } else {
    form.button("Border effects\n§9"+effect.name);
  }
  actions.push(() => {
    border_effect(player)
  });

  if (world.getAllPlayers().length > 1) {
    let val = save_data[0].one_boarder
    form.button("One boarder for all players\n"+ (val? "§aon" : "§coff"),val ? "textures/ui/toggle_on" : "textures/ui/toggle_off");
    actions.push(() => {
      save_data[0].one_boarder == true? save_data[0].one_boarder = false : save_data[0].one_boarder = true
      update_save_data(save_data)
      config(player)
  });
  }

  form.divider()
  form.button("");
  actions.push(() => {
    world.scoreboard.addObjective("ccs_data");
    world.scoreboard.getObjective("ccs_data").setScore(JSON.stringify({event: "ccs_main", data:{source: version_info.uuid}}), 1);
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

function border_effect(player) {
  let form = new ActionFormData()
  let actions = []
  let save_data = load_save_data()
  form.title("Border effect")

  form.body("Select your Border effect!");


  const selectedIndex = save_data[0].border_effects_index;
  const selectedEffect = border_effects_list[selectedIndex];
  const otherEffects = border_effects_list.filter((_, i) => i !== selectedIndex);

  if (selectedEffect) {
    if (selectedEffect.textures) {
      form.button(selectedEffect.name + "\n§2(selected)", selectedEffect.textures);
    } else {
      form.button(selectedEffect.name + "\n§2(selected)");
    }

    actions.push(() => {
      save_data[0].border_effects_index = selectedIndex;
      update_save_data(save_data);
      border_effect(player)
    });

    if (otherEffects.length > 0) {
      form.divider();
    }
  }

  otherEffects.forEach((effect) => {
    const originalIndex = border_effects_list.indexOf(effect);

    if (effect.textures) {
      form.button(effect.name, effect.textures);
    } else {
      form.button(effect.name);
    }

    actions.push(() => {
      save_data[0].border_effects_index = originalIndex;
      update_save_data(save_data);
      border_effect(player)
    });
  });


  form.divider()
  form.button("");
  actions.push(() => {
    config(player)
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
  await system.waitTicks(3);

  if (!is_initialized) {
    for (const p of players) {
      p.sendMessage('§l§4[§cError§4]§r The timer is not installed correctly! Check that the timer is active and has the correct CCS version.');
      p.playSound("random.pop");
    }
    return -1;
  }

  const oldLevels = {}; // oldLevels.global or oldLevels[player.id]
  const clamp = (v, a, b) => Math.max(a, Math.min(v, b));
  const contrib = lvl => (Number(lvl) >= 1 ? Math.floor(Number(lvl)) : 0.5);
  const finalize = sum => (sum >= 1 ? Math.floor(sum) : 0.5);

  while (true) {
    const saveData = load_save_data();
    const players = world.getAllPlayers();
    const one = !!(saveData[0] && saveData[0].one_boarder === true);

    // Global: sum contributions, then finalize to integer (or 0.5)
    const globalSum = one ? players.reduce((s, pl) => s + contrib(pl.level), 0) : null;
    const globalRadius = one ? finalize(globalSum) : null;
    const prevGlobal = one ? (Object.prototype.hasOwnProperty.call(oldLevels, 'global') ? oldLevels.global : null) : null;

    for (const player of players) {
      const x = player.location.x, z = player.location.z;
      const radius = one ? globalRadius : finalize(contrib(player.level));
      const newX = clamp(x, -radius, radius);
      const newZ = clamp(z, -radius, radius);
      const outside = newX !== x || newZ !== z;

      if (challenge_running && outside && radius < 24791) {
        player.teleport({ x: newX, y: player.location.y, z: newZ });
        try {
          const air1 = (player.dimension.getBlock({ x: newX, y: player.location.y, z: newZ }).isAir || player.dimension.getBlock({ x: newX, y: player.location.y, z: newZ }).isLiquid);
          const air2 = (player.dimension.getBlock({ x: newX, y: player.location.y + 1, z: newZ }).isAir || player.dimension.getBlock({ x: newX, y: player.location.y + 1, z: newZ }).isLiquid);
          const topY = player.dimension.getTopmostBlock({ x: newX, z: newZ }).y;
          if (!(air1 && air2) || player.location.y - topY > 3) {
            player.teleport({ x: newX, y: topY + 1, z: newZ });
          }
        } catch (e) {
          const topY = player.dimension.getTopmostBlock({ x: newX, z: newZ }).y;
          player.teleport({ x: newX, y: topY + 1, z: newZ });
        }
      }

      if (radius < 24791 && challenge_running) spawnBorderParticles(player, radius);
    }

    function sendBorderMsg(p, newR, oldR) {
      if (oldR === null) return; // erste Messung -> keine Nachricht
      if (newR === 24791) {
        p.runCommand('playsound random.orb @a');
        p.sendMessage(`§l§c[§bWorld Border§c]§r The world border is turned off because you have reached the maximum level of §l§a${newR}§r!`);
      } else if (newR > oldR) {
        p.runCommand('playsound random.orb @a');
        p.sendMessage(`§l§c[§bWorld Border§c]§r The world border expanded to §l§a${newR} Blocks§r!`);
      } else if (newR < oldR) {
        p.runCommand('playsound note.bassattack @a');
        p.sendMessage(`§l§c[§bWorld Border§c]§r The world border reduced by §l§a${oldR - newR} Block${oldR - newR === 1 ? '' : 's'}§r! Now it is §l§a${newR} Blocks§r!`);
      }
    }

    if (one) {
      if (globalRadius !== prevGlobal) {
        for (const p of players) sendBorderMsg(p, globalRadius, prevGlobal);
        oldLevels.global = globalRadius;
      }
    } else {
      for (const p of players) {
        const r = finalize(contrib(p.level));
        const prev = Object.prototype.hasOwnProperty.call(oldLevels, p.id) ? oldLevels[p.id] : null;
        if (r !== prev) {
          sendBorderMsg(p, r, prev);
          oldLevels[p.id] = r;
        }
      }
    }

    await system.waitTicks(1);
  }
}






system.run(() => update_loop());