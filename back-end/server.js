const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const cors = require("cors");


const app = express();
const PORT = 5500;

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "uma_senha_super_forte_aqui",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 dia
}));

// --- Conectar MongoDB ---
mongoose.connect("mongodb://127.0.0.1:27017/users", {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("MongoDB conectado"))
.catch(err => console.error("Erro MongoDB", err));

// --- Schema do Usuário ---
const usuarioSchema = new mongoose.Schema({
  nome: String,
  email: { type: String, unique: true },
  senha: String,
  telefone: String,
  endereco: String,
  complemento: String
});

const Usuario = mongoose.model("Usuario", usuarioSchema);

// --- Middleware de proteção ---
function verificarAutenticacao(req, res, next) {
  if (req.session.userId) return next();
  res.redirect("/login.html");
}

// --- Rotas POST ---
// Cadastro
app.post("/cadastro", async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) return res.status(400).json({ error: "Campos faltando" });

    const senhaHash = await bcrypt.hash(senha, 10);

    const novoUsuario = new Usuario({ nome, email, senha: senhaHash });
    await novoUsuario.save();

    // RESPONDER JSON
    return res.json({ message: "Cadastro realizado com sucesso!" });

  } catch (err) {
    console.error(err);
    if (err.code === 11000) return res.status(400).json({ error: "Email já cadastrado" });
    return res.status(500).json({ error: "Erro no servidor" });
  }
});


// Login
app.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;
    const usuario = await Usuario.findOne({ email });
    if (!usuario) return res.status(400).json({ error: "Usuário não encontrado" });

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) return res.status(400).json({ error: "Senha incorreta" });

    req.session.userId = usuario._id;

    // Retorne JSON indicando sucesso
    res.json({ message: "Login realizado com sucesso!" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});


// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send("Erro ao deslogar");
    res.redirect("/login.html?message=Você foi deslogado.");
  });
});

// Home protegido
app.get("/home.html", verificarAutenticacao, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

// Conectar ao MongoDB
mongoose.connect("mongodb://127.0.0.1:27017/carrinhoDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("MongoDB conectado"))
  .catch(err => console.log("Erro MongoDB:", err));

// Schema do carrinho
const carrinhoSchema = new mongoose.Schema({
  produto: String,
  preco: Number,
  quantidade: Number
});
const ItemCarrinho = mongoose.model("ItemCarrinho", carrinhoSchema);

// Middleware de proteção (simples)
function verificarAutenticacao(req, res, next) {
  if (req.session.autenticado) return next();
  // Para simplificar, vamos autenticar automaticamente
  req.session.autenticado = true;
  next();
}

// Rotas protegidas
app.get("/home.html", verificarAutenticacao, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

app.post("/api/carrinho/adicionar", verificarAutenticacao, async (req, res) => {
  try {
    const { produto, preco, quantidade } = req.body;

    // validação básica
    if (!produto || !preco || !quantidade) {
      return res.status(400).json({ error: "Produto, preço e quantidade são obrigatórios." });
    }

    // tenta achar o produto no carrinho
    let item = await ItemCarrinho.findOne({ produto });

    if (item) {
      item.quantidade += quantidade;
    } else {
      item = new ItemCarrinho({ produto, preco, quantidade });
    }

    await item.save();
    res.json({ message: "Produto adicionado com sucesso!", item });
  } catch (err) {
    console.error("Erro ao adicionar produto:", err);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});



// Servir arquivos estáticos
app.use("/public", express.static(path.join(__dirname, "public")));




app.listen(PORT, () => console.log(`Servidor rodando em http://127.0.0.1:${PORT}`));
