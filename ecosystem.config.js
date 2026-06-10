module.exports = {
  apps: [
    {
      name: 'chatbot-garageinn',
      script: 'bot.js',
      restart_delay: 5000,
      max_restarts: 20,
      watch: false,
      env: {
        NODE_ENV: 'production',
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
        CHROME_PATH: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      },
    },
  ],
};
