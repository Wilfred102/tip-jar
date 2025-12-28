# STX Tip Jar

A full-stack decentralized application (dApp) on the Stacks blockchain that empowers fans to directly tip creators using STX. This project demonstrates a production-ready architecture combining a React frontend, a Node.js/Express backend, and a Clarity smart contract.

## 🌟 Features

### Frontend
- **Direct Tipping**: Send STX tips directly to creators via the Stacks blockchain.
- **Wallet Integration**: Seamless connection with Stacks wallets (e.g., Leather, Xverse) using WalletConnect v2 (via Reown AppKit) and `@stacks/connect`.
- **Real-time Stats**: View live data including total tips, recent transactions, and top tippers.
- **Responsive Design**: A modern, mobile-friendly UI with a premium aesthetic.

### Backend
- **Creator Profiles**: Manage creator information and portfolios.
- **Works Gallery**: Showcase creators' work (music, art, etc.).
- **Transaction Monitoring**: Track and index tips for enhanced data persistence.
- **API**: RESTful endpoints for fetching creator and tip data.

### Smart Contract
- **On-chain Logic**: Securely handles tip transfers.
- **Minimum Tip**: Enforces a minimum tip amount (e.g., 0.1 STX) to prevent spam.
- **History**: Stores total tips and a ring buffer of the last 5 tips on-chain.

---

## 🏗 Architecture

The project is structured as a monorepo with three main components:

- **`contracts/`**: Clarity smart contracts.
- **`frontend/`**: React application (Vite + TypeScript).
- **`backend/`**: Node.js API (Express + MongoDB).

---

## 🛠 Tech Stack

- **Blockchain**: Stacks (Clarity)
- **Frontend**: React, TypeScript, Vite, Stacks.js, WalletConnect (Reown AppKit)
- **Backend**: Node.js, Express, MongoDB (Mongoose)
- **Monitoring**: Sentry (optional)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18 or higher recommended.
- **MongoDB**: A running MongoDB instance (local or cloud like Atlas).
- **Stacks Wallet**: A browser extension wallet (e.g., Leather) or mobile wallet.
- **WalletConnect Project ID**: (Optional) Get one from [Reown Cloud](https://cloud.reown.com/) for WalletConnect support.

### 1. Smart Contract

The contract is located in `contracts/tip-jar.clar`.
- **Mainnet Deployment**: The frontend is currently configured to point to a deployed mainnet contract.
- **Local Development**: You can use Clarinet to test and deploy the contract locally.

### 2. Backend Setup

The backend handles creator data and off-chain indexing.

1.  Navigate to the backend directory:
    ```bash
    cd tip-jar/backend
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Create a `.env` file in `tip-jar/backend/` with the following variables:
    ```env
    PORT=5001
    MONGODB_URI=mongodb://localhost:27017/tipjar
    CORS_ORIGIN=http://localhost:5173
    # Optional
    SENTRY_DSN=your_sentry_dsn
    NODE_ENV=development
    ```

4.  Start the server:
    ```bash
    npm run dev
    ```
    The API will run on `http://localhost:5001`.

### 3. Frontend Setup

The frontend is the user interface for tipping and viewing stats.

1.  Navigate to the frontend directory:
    ```bash
    cd tip-jar/frontend
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Create a `.env` file in `tip-jar/frontend/` (or use existing defaults):
    ```env
    # The Stacks contract address (Mainnet default provided in config)
    VITE_CONTRACT_ID=SP2A8V93XXB43Q8JXQNCS9EBFHZJ6A2HVXHC4F4ZB.tip-jar
    
    # Your WalletConnect Project ID (Required for WalletConnect)
    VITE_WALLETCONNECT_PROJECT_ID=YOUR_WC_PROJECT_ID
    ```

4.  Start the development server:
    ```bash
    npm run dev
    ```
    Open `http://localhost:5173` in your browser.

---

## 📡 API Documentation

The backend provides the following main endpoints (prefixed with `/api`):

- **`/creators`**:
    - `GET /`: List all creators.
    - `POST /`: Create a new creator profile.
    - `GET /:id`: Get specific creator details.
- **`/works`**:
    - `GET /`: List works.
    - `POST /`: Add a new work.
- **`/tips`**:
    - `GET /`: Get tip history (off-chain indexed).
- **`/monitor`**:
    - Endpoints for monitoring blockchain events.

---

## 📜 Smart Contract Interface

The `tip-jar` contract exposes:

- **`tip(amount uint)`**: Public function to send STX to the creator.
- **`get-total-tips`**: Read-only function returning the total amount tipped.
- **`get-recent-tip(index uint)`**: Read-only function to get details of a recent tip by index.

---

## 🤝 Contributing

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/amazing-feature`).
3.  Commit your changes (`git commit -m 'Add amazing feature'`).
4.  Push to the branch (`git push origin feature/amazing-feature`).
5.  Open a Pull Request.

---

## 📄 License

This project is licensed under the MIT License.