const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // Khai báo chuẩn bản mới
const { engine } = require('express-handlebars');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. KẾT NỐI ĐA LUỒNG
const readConnection = mongoose.createConnection(process.env.DB_READ_URI);
const writeConnection = mongoose.createConnection(process.env.DB_WRITE_URI);

readConnection.on('connected', () => console.log('Đã kết nối luồng ĐỌC (Read-only)'));
writeConnection.on('connected', () => console.log('Đã kết nối luồng GHI (Write)'));

// 2. STATELESS SESSION (Bản mới nhất dùng .create)
app.use(session({
    secret: 'khoa_bao_mat_phien_lam_viec_cua_toi',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.DB_WRITE_URI,
        collectionName: 'sessions',
        ttl: 14 * 24 * 60 * 60 
    }),
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 }
}));

// 3. CẤU HÌNH HANDLEBARS
app.engine('hbs', engine({ extname: '.hbs' }));
app.set('view engine', 'hbs');
app.set('views', './views');

// 4. MODEL & ROUTER
const bookSchema = new mongoose.Schema({
    bookCode: String,
    title: String,
    price: Number,
    priceWithVAT: Number
});

const BookRead = readConnection.model('Book', bookSchema);
const BookWrite = writeConnection.model('Book', bookSchema);

app.get('/', async (req, res) => {
    res.render('home', {
        title: "Quản lý Sách",
        hoten: "Hồ Đắc Khánh", 
        mssv: "23IT123",      
        vat: "7%"  // Đã khôi phục lại 7% (3 + 4 = 7)
    });
});

app.get('/books', async (req, res) => {
    try {
        const books = await BookRead.find(); 
        res.json(books); 
    } catch (err) {
        res.status(500).send("Lỗi đọc dữ liệu");
    }
});

app.post('/books', async (req, res) => {
    try {
        const { bookCode, title, price } = req.body;
        const mssv_suffix = "123"; 

        if (!bookCode.startsWith(mssv_suffix)) {
            return res.status(400).json({ 
                error: `Mã sản phẩm không hợp lệ! Bắt buộc phải bắt đầu bằng ${mssv_suffix}` 
            });
        }

        // Đã khôi phục lại logic tính VAT động (Số cuối + 4)
        const lastDigit = parseInt(mssv_suffix.slice(-1)); 
        const vatRate = lastDigit + 4; 
        const calculatedPriceWithVAT = price + (price * vatRate / 100);

        req.body.priceWithVAT = calculatedPriceWithVAT;

        const newBook = new BookWrite(req.body); 
        await newBook.save(); 
        
        res.status(201).send("Thêm sách thành công!");
    } catch (err) {
        res.status(500).send("Lỗi ghi dữ liệu: " + err.message);
    }
});

app.listen(3000, () => {
    console.log('Server đang chạy tại: http://localhost:3000');
});