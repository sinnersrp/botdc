require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const commands = [];
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

console.log("Arquivos encontrados:", commandFiles);

for (const file of commandFiles) {
  try {
    console.log(`🔍 Testando: ${file}`);

    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if (!command.data || !command.execute) {
      console.log(`❌ Arquivo inválido: ${file}`);
      continue;
    }

    commands.push(command.data.toJSON());
    console.log(`✅ OK: ${command.data.name}`);
  } catch (error) {
    console.log(`💥 ERRO NO ARQUIVO: ${file}`);
    console.error(error);
  }
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("📡 Enviando comandos:", commands.map(c => c.name));
    console.log("🔄 Registrando comandos...");

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.log("✅ Comandos registrados com sucesso.");
  } catch (error) {
    console.error("❌ Erro ao registrar comandos:");
    console.error(error);
  }
})();