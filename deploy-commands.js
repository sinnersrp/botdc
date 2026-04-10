require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");

const commands = [];
const seenNames = new Set();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

console.log("Arquivos encontrados:", commandFiles);

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);

  try {
    delete require.cache[require.resolve(filePath)];
    const command = require(filePath);

    console.log(`🔎 Testando: ${file}`);

    if (!command || !command.data || !command.execute) {
      console.log(`❌ Arquivo inválido: ${file}`);
      continue;
    }

    const json = command.data.toJSON();

    if (!json.name) {
      console.log(`❌ Comando sem nome: ${file}`);
      continue;
    }

    if (seenNames.has(json.name)) {
      console.log(`⚠️ Nome duplicado ignorado: ${json.name} (${file})`);
      continue;
    }

    seenNames.add(json.name);
    commands.push(json);

    console.log(`✅ OK: ${json.name}`);
  } catch (error) {
    console.log(`❌ Erro ao carregar ${file}:`);
    console.error(error);
  }
}

console.log("📤 Enviando comandos:", commands.map((cmd) => cmd.name));

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("📝 Registrando comandos...");

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log("✅ Comandos registrados com sucesso.");
  } catch (error) {
    console.error("❌ Erro ao registrar comandos:");
    console.error(error);
  }
})();