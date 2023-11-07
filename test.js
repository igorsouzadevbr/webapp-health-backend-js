const socketIO = require('socket.io');

class SocketConnection {
    constructor(httpServer) {
        this.io = socketIO(httpServer, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST'],
            },
        });

        this.io.on('connection', (socket) => {
            console.log(`Socket conectado: ${socket.id}`);

            // Lógica para manipular mensagens recebidas do cliente
            socket.on('message', (data) => {
                console.log(`Mensagem recebida: ${data}`);

                // Enviar a mensagem de volta para todos os clientes conectados
                this.io.emit('message', data);
            });

            // Lógica para lidar com desconexões de cliente
            socket.on('disconnect', () => {
                console.log(`Socket desconectado: ${socket.id}`);
            });
        });
    }
}

module.exports = SocketConnection;
