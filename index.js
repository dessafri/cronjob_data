const express = require('express'); // untuk request HTTP
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.json()); // parsing JSON body

// WebSocket connection
io.on('connection', (socket) => {
    console.log('User terhubung:', socket.id);

    socket.on('disconnect', () => {
        console.log('User terputus:', socket.id);
    });
});

// Fungsi kirim pesan ke chatbot
async function sendMessage(phoneNumber, message) {
    const urlChatbot = `http://localhost:6099/chat/sendmessage/${phoneNumber}`;
    const postParameter = { message };
    try {
        const response = await fetch(urlChatbot, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postParameter),
        });

        if (response.ok) {
            const info = `Pesan ke ${phoneNumber} berhasil dikirim`;
            console.log(info);
            return { status: 'success', code: 200 };
        } else {
            const info = `Gagal kirim pesan ke ${phoneNumber}`;
            console.error(info);
            io.emit('message', { status: info, type: 'error' });
            return { status: 'error', code: 400 };
        }
    } catch (error) {
        const errMsg = `Error kirim pesan ke ${phoneNumber}: ${error.message}`;
        console.error(errMsg);
        io.emit('message', { status: errMsg, type: 'error' });
        return { status: 'error', code: 500 };
    }
}

// Fungsi kirim pesan bertahap dengan jeda
async function sendMessagesWithDelay(data, delayMs) {
    for (const item of data) {
        console.log(item);
        const { nomor_handphone, message, kode_order } = item;

        const response = await sendMessage(nomor_handphone, message);
        if (response.code == 200) {
            let url = `http://localhost:8000/api/update-status/${kode_order}`;
            let apiToken = 'Vm0xNFlWbFdXWGhVV0doVVlUSlNWVmxVUm5kWFJteFZVMnhPVjFKc1NsZFhhMk0xVmtVeFYxWnFWbUZTVmtwRVZteGFZV014VG5OYVJsWnBVbTVDUlZadE1UUlRNazV6V2toT1ZtSkhVbGhWYkZwM1ZsWmFkRTFVVWxwV01ERTBXVEJXYTJGV1NuUmhSbWhhWWxoU1RGcEhlRnBsUm10NllVWldUbUV4V1RCWFZFSmhZakZrU0ZOc1ZsZGlWR3hYV1ZkMGRrMUdjRlpYYkU1WFRWWmFlVmt3WkRSaFIxWnpWMnRrVjJKWWFGTmFSRVpEVld4Q1ZVMUVNRDA9'
            let penagihan_total = 0;
            let penagihan_deliver = 0;
            let penagihan_not_deliver = 0;
            fetch(url, {
                method: 'POST',
                body: JSON.stringify({
                    status: 1,
                    waktu_kirim: new Date().toISOString()
                }),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiToken,
                }
            }).then(response => response.json()).then(data => {
                penagihan_total = data.total_penagihan;
                penagihan_deliver = data.penagihan_deliver;
                penagihan_not_deliver = data.penagihan_not_deliver

                io.emit('message', { status: `Pesan ke ${nomor_handphone} berhasil dikirim Dengan Kode Order ${kode_order}`, type: 'success', totalPenagihan: penagihan_total, penagihanDeliver: penagihan_deliver, penagihanNotDeliver: penagihan_not_deliver });

            });
        }

        // Delay kecuali setelah pesan terakhir
        if (item !== data[data.length - 1]) {
            console.log(`Tunggu ${delayMs / 1000} detik sebelum pesan berikutnya...`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
    setTimeout(() => {
        io.emit('message-done', { status: 'Proses Pengiriman Pesan Selesai', type: 'success' });
    }, 5000);
    console.log('Semua pesan sudah dikirim');
}

// Endpoint trigger pengiriman pesan
app.post('/trigger-send', (req, res) => {
    const data = req.body.data;
    const interval = parseInt(req.body.interval, 10) * 60000;

    if (!Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ message: 'Data tidak valid atau kosong' });
    }
    setTimeout(() => {
        io.emit('message', { status: 'Proses Pengiriman Pesan Dimulai dengan Jeda Waktu Tiap Pesan Selama ' + req.body.interval + ' Menit', type: 'success' });
        res.json({ status: 'success', message: 'Proses pengiriman pesan dimulai' });
        setTimeout(() => {
            sendMessagesWithDelay(data, interval).catch(console.error);
        }, 6000);
    }, 5000);
});

// Jalankan server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
