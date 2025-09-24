const { Agent } = require('sentient-agent-framework');

async function main() {
  // Create an instance of the Agent
  const agent = new Agent();

  // Launch the agent
  await agent.launch();
}

main().catch(console.error);