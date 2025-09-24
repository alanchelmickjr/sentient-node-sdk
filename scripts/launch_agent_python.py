import ulid
from sentient_agent_framework.interface.agent import AbstractAgent
from sentient_agent_framework.implementation.default_hook import DefaultHook
from sentient_agent_framework.implementation.default_response_handler import DefaultResponseHandler
from sentient_agent_framework.interface.identity import Identity

class MyAgent(AbstractAgent):
    def __init__(self, name):
        super().__init__(name)
        self.hook = DefaultHook([])
        self.source = Identity(id=ulid.new().str, name=name)
        self.response_handler = DefaultResponseHandler(self.source, self.hook)

    def assist(self, query):
        print(f"Assisting with query: {query}")

    def launch(self):
        print("Agent launched")

def main():
    agent = MyAgent("MyAgent")
    agent.launch()

if __name__ == "__main__":
    main()