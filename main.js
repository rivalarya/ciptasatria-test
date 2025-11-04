const express = require('express');
const app = express();
const dotenv = require('dotenv');

dotenv.config();

app.post('/api/notifications', (req, res) => {
    res.send('Hello World!');
});
app.get('/internal/queue/stats', (req, res) => {
    res.send('Hello World!');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
