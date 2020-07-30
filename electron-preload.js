// preload.js for Electron app
const { ipcRenderer } = require('electron');

process.once('loaded', () => {
  ipcRenderer.on('updateFile', (event, data) => {
    console.log('updateFile', data);
    data.cmd = 'updateFile';
    postMessage(data);
  });
  window.addEventListener('message', event => {
    const message = event.data;
    console.log('MESSAGE', event, message);
    //if (message.myTypeField === 'my-custom-message') {
      //ipcRenderer.send('custom-message', message);
    //}
  });
  //ipcRenderer.send('hello', true);
});
