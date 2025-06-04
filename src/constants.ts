// Ollama models configuration
// You can see the complete list of available models at https://ollama.ai/models
export const ollamaEmbeddingsModel = 'nomic-embed-text:latest';
export const ollamaChatModel = 'llama3.1:latest';

// Faiss local store folder
export const faissStoreFolder = '.faiss';

// Business context information
export const businessContext = {
  accommodation: { name: 'Accommodation', phone: '+111111111' },
  sports_club: { name: 'Sports Club', phone: '+2222222222' },
  surf_school: { name: 'Surf School', phone: '+3333333' },
};

export const COMMANDS = {
  CALL_HUMAN: '/callhuman',
};
