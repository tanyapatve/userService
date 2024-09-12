require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

/////// Middleware auth. /////////
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

/////////// Register /////////////
app.post('/users', async (req, res) => {
    try {
        const {name, surname, displayName, email, tel, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (name, surname, display_name, email, tel, password) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, surname, displayName, email, tel, hashedPassword]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message});
    }
});

/////////// Login /////////////
app.post('/login', async (req, res) => {
    try {
        const { email, password} = req.body;
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(400).json({ error: "User not found" });
        }
        const user = result.rows[0];
        if (await bcrypt.compare(password, user.password)) {
            const accessToken = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET);
            res.json({ accessToken: accessToken });
        } else {
            res.status(400).json({ error: "Invalid password" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message});
    }
});

/////////// Get User Profile /////////////
app.get('/users/:id', authenticateToken, async (req, res) => {
    try {
        const {id} = req.params;
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found"});
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/////////// Update User Profile /////////////
app.put('/users/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, surname, displayName, email, tel } = req.body;
        const result = await pool.query(
            'UPDATE users SET name = $1, surname = $2, display_name = $3, email = $4, tel = $5 WHERE id = $6 RETURNING *',
            [name, surname, displayName, email, tel, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/users/:id', authenticateToken, async (req, res) => {
    try {
        const {id} = req.params;
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json({ message: "User delete successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`User service is running on port ${PORT}`));