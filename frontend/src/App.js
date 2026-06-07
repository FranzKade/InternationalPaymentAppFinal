import React, { useState, useEffect } from "react";
import "./App.css";

import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "firebase/auth";

import {
  collection,
  query,
  onSnapshot,
  orderBy,
  getDocs
} from "firebase/firestore";

function App() {
  const [page, setPage] = useState("login");
  const [message, setMessage] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [transactions, setTransactions] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setCurrentUser(null);
        setPage("login");
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!currentUser || page !== "dashboard") return;

    const q = query(
      collection(db, "payments"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));

        setTransactions(list);
      },
      (error) => {
        setMessage(error.message);
      }
    );

    return () => unsubscribe();
  }, [currentUser, page]);

  const login = async () => {
    setMessage("");

    if (!email || !password) {
      setMessage("Please enter email and password.");
      return;
    }

    if (!emailRegex.test(email)) {
      setMessage("Please enter a valid email address.");
      return;
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);

      const employeeSnapshot = await getDocs(collection(db, "Employees"));

      const employeeExists = employeeSnapshot.docs.some((doc) => {
        const employeeEmail = doc.data().email;

        return (
          employeeEmail &&
          employeeEmail.toLowerCase() === cred.user.email.toLowerCase()
        );
      });

      if (!employeeExists) {
        await signOut(auth);
        setCurrentUser(null);
        setPage("login");
        setMessage("Access denied. Only registered employees may access this portal.");
        return;
      }

      setCurrentUser(cred.user);
      setPage("dashboard");
      setMessage("Employee login successful.");

    } catch (err) {
      setCurrentUser(null);
      setPage("login");
      setMessage(err.message);
    }
  };

  const logout = async () => {
    setMessage("");
    setEmail("");
    setPassword("");
    setCurrentUser(null);
    await signOut(auth);
    setPage("login");
  };

  return (
    <div className="app-background">
      <div className="form-card">
        {message && <div className="message">{message}</div>}

        {!currentUser && page === "login" && (
          <>
            <h1>EMPLOYEE LOGIN</h1>

            <label>EMAIL</label>
            <input
              value={email}
              autoComplete="off"
              onChange={(e) => {
                setMessage("");
                setEmail(e.target.value);
              }}
            />

            <label>PASSWORD</label>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => {
                setMessage("");
                setPassword(e.target.value);
              }}
            />

            <button type="button" onClick={login}>
              Login
            </button>
          </>
        )}

        {currentUser && page === "dashboard" && (
          <>
            <h1>EMPLOYEE DASHBOARD</h1>

            <button className="secondary-btn" onClick={logout}>
              Logout
            </button>

            <div style={{ marginTop: "30px" }}>
              <h2>INTERNATIONAL PAYMENTS</h2>

              {transactions.length === 0 ? (
                <p>No payments found.</p>
              ) : (
                transactions.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      border: "1px solid #ccc",
                      padding: "12px",
                      marginBottom: "12px",
                      borderRadius: "10px",
                      backgroundColor: "#f9f9f9",
                      textAlign: "left"
                    }}
                  >
                    <p><strong>Recipient:</strong> {t.recipient}</p>
                    <p>
                      <strong>Amount:</strong> {t.currency}{" "}
                      {Number(t.amount).toFixed(2)}
                    </p>
                    <p><strong>SWIFT Code:</strong> {t.swiftCode}</p>
                    <p><strong>Currency:</strong> {t.currency}</p>
                    <p><strong>Status:</strong> {t.status || "Pending"}</p>
                    <p>
                      <strong>Date:</strong>{" "}
                      {t.createdAt?.toDate
                        ? t.createdAt.toDate().toLocaleString()
                        : "No date"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;