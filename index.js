const express = require('express'); // untuk request HTTP
const axios = require('axios'); // untuk request HTTP
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        transports: ["websocket", "polling"],
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
            const url = `https://bsderma.com/api/update-status/${kode_order}`;
            const apiToken = 'Vm0xNFlWbFdXWGhVV0doVVlUSlNWVmxVUm5kWFJteFZVMnhPVjFKc1NsZFhhMk0xVmtVeFYxWnFWbUZTVmtwRVZteGFZV014VG5OYVJsWnBVbTVDUlZadE1UUlRNazV6V2toT1ZtSkhVbGhWYkZwM1ZsWmFkRTFVVWxwV01ERTBXVEJXYTJGV1NuUmhSbWhhWWxoU1RGcEhlRnBsUm10NllVWldUbUV4V1RCWFZFSmhZakZrU0ZOc1ZsZGlWR3hYV1ZkMGRrMUdjRlpYYkU1WFRWWmFlVmt3WkRSaFIxWnpWMnRrVjJKWWFGTmFSRVpEVld4Q1ZVMUVNRDA9';

            try {
                const postData = {
                    status: 1,
                    waktu_kirim: new Date().toISOString(),
                };

                const axiosResponse = await axios.post(url, postData, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiToken}`,
                    },
                });

                const data = axiosResponse.data;

                const penagihan_total = data.total_penagihan;
                const penagihan_deliver = data.penagihan_deliver;
                const penagihan_not_deliver = data.penagihan_not_deliver;

                io.emit('message', {
                    status: `Pesan ke ${nomor_handphone} berhasil dikirim Dengan Kode Order ${kode_order}`,
                    type: 'success',
                    totalPenagihan: penagihan_total,
                    penagihanDeliver: penagihan_deliver,
                    penagihanNotDeliver: penagihan_not_deliver,
                });

            } catch (error) {
                console.error('Error updating status:', error);
                io.emit('message', {
                    status: `Gagal mengirim pesan ke ${nomor_handphone} dengan Kode Order ${kode_order}`,
                    type: 'error',
                    error: error.message,
                });
            }
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
app.get('/test', (req, res) => {
    res.send('Server jalan dengan socket.io');
});

// Fungsi ambil data customer
async function getDataCustomer() {
    const url = `https://bsderma.com/api/get-customer`;
    const apiToken = 'Vm0xNFlWbFdXWGhVV0doVVlUSlNWVmxVUm5kWFJteFZVMnhPVjFKc1NsZFhhMk0xVmtVeFYxWnFWbUZTVmtwRVZteGFZV014VG5OYVJsWnBVbTVDUlZadE1UUlRNazV6V2toT1ZtSkhVbGhWYkZwM1ZsWmFkRTFVVWxwV01ERTBXVEJXYTJGV1NuUmhSbWhhWWxoU1RGcEhlRnBsUm10NllVWldUbUV4V1RCWFZFSmhZakZrU0ZOc1ZsZGlWR3hYV1ZkMGRrMUdjRlpYYkU1WFRWWmFlVmt3WkRSaFIxWnpWMnRrVjJKWWFGTmFSRVpEVld4Q1ZVMUVNRDA9';
    try {
        const response = await axios.get(url, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken}`,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Gagal ambil data customer:', error.message);
        return [];
    }
}

// Fungsi kirim batch berulang dengan jeda antar batch
async function sendWithInterval(data, interval, jeda) {
    // Kirim batch sekarang
    if (Array.isArray(data) && data.length > 0) {
        console.log('Mengirim batch dengan', data.length, 'item...');
        await sendMessagesWithDelay(data, interval);
    } else {
        console.log('Data kosong, tidak ada yang dikirim.');
        return;
    }

    // Tunggu sebelum kirim ulang
    console.log(`Menunggu jeda ${jeda / 60000} menit...`);
    await new Promise(resolve => setTimeout(resolve, jeda));

    // Ambil data baru
    const nextData = await getDataCustomer();

    if (Array.isArray(nextData) && nextData.length > 0) {
        await sendWithInterval(nextData, interval, jeda); // Ulangi
    } else {
        console.log('Semua data telah dikirim. Selesai.');
    }
}

// Endpoint trigger
app.post('/trigger-send', async (req, res) => {
    const data = req.body.data;
    const interval = parseInt(req.body.interval, 10) * 60000; // jeda antar pesan
    const jeda = parseInt(req.body.jeda, 10) * 60000; // jeda antar batch

    if (!Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ message: 'Data tidak valid atau kosong' });
    }

    // Kirim respons ke client dulu
    res.json({ status: 'success', message: 'Pengiriman pesan dimulai' });

    // Beri notifikasi ke frontend
    io.emit('message', {
        status: `Pengiriman dimulai. Jeda antar pesan: ${req.body.interval} menit, jeda antar batch: ${req.body.jeda} menit.`,
        type: 'success',
    });

    // Tunggu 5 detik lalu mulai proses
    setTimeout(async () => {
        await sendWithInterval(data, interval, jeda);
    }, 5000);
});


// Jalankan server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
