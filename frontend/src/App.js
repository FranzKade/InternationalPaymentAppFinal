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
  getDocs,
  doc,
  updateDoc
} from "firebase/firestore";

function App() {
  const [page, setPage] = useState("login");
  const [message, setMessage] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [transactions, setTransactions] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

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
    async (snapshot) => {
      try {
        // Load all users
        const usersSnapshot = await getDocs(
          collection(db, "users")
        );

        // Create lookup map:
        
        // key = Firebase Auth UID
        const usersMap = {};

        usersSnapshot.forEach((userDoc) => {
          const userData = userDoc.data();

          if (userData.uid) {
            usersMap[userData.uid] = userData;
          }
        });

        console.log("USERS MAP:", usersMap);

        // Merge payment + user data
        const paymentList = await Promise.all(
  snapshot.docs.map(async (paymentDoc) => {
    const paymentData = paymentDoc.data();

    let customerName = "";
    let accountNumber = "";

    try {
      const usersSnapshot = await getDocs(
        collection(db, "users")
      );

      const matchingUser = usersSnapshot.docs.find(
        (userDoc) =>
          userDoc.data().uid === paymentData.userId
      );

      if (matchingUser) {
        const userData = matchingUser.data();

        customerName =
          userData.username ||
          userData.fullName ||
          userData.name ||
          "";

        accountNumber =
          userData.accountNumber ||
          userData.accountNo ||
          "";
      }
    } catch (error) {
      console.error(
        "User lookup failed:",
        error
      );
    }

    return {
      id: paymentDoc.id,
      ...paymentData,
      customerName,
      accountNumber
    };
  })
);

setTransactions(paymentList);
      } catch (error) {
        console.error(error);
        setMessage(
          "Failed to load customer information."
        );
      }
    },
    (error) => {
      console.error(error);
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

  const verifyTransaction = async (id) => {
  try {
    await updateDoc(doc(db, "payments", id), {
      status: "Verified"
    });

    setMessage("Transaction verified successfully.");
  } catch (error) {
    console.error(error);
    setMessage("Verification failed.");
  }
};

const submitToSwift = async (id, status) => {
  if (status !== "Verified") {
    setMessage("Transaction must be verified first.");
    return;
  }

  try {
    await updateDoc(doc(db, "payments", id), {
      status: "Submitted to SWIFT"
    });

    setMessage("Transaction submitted to SWIFT.");
  } catch (error) {
    console.error(error);
    setMessage("SWIFT submission failed.");
  }
};

  const filteredTransactions = transactions.filter((t) => {

  const customerName =
    (t.customerName || t.username || "").toLowerCase();

  const accountNumber =
    (t.accountNumber || "").toLowerCase();

  const search = searchTerm.toLowerCase();

  return (
    customerName.includes(search) ||
    accountNumber.includes(search)
  );
});

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
                <>
  <input
    type="text"
    placeholder="Search customer or account..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    style={{
      width: "100%",
      padding: "10px",
      marginBottom: "20px"
    }}
  />

  <table className="transaction-table">
    <thead>
      <tr>
        <th>Customer Name</th>
        <th>Account Number</th>
        <th>Amount</th>
        <th>Currency</th>
        <th>SWIFT Code</th>
        <th>Beneficiary Details</th>
        <th>Status</th>
        <th>Actions</th>
        <th>Date Submitted</th>
      </tr>
    </thead>

    <tbody>
      {filteredTransactions.map((t) => (
        <tr key={t.id}>
          <td>{t.customerName || t.username}</td>

          <td>{t.accountNumber}</td>

          <td>
            {Number(t.amount).toFixed(2)}
          </td>

          <td>{t.currency}</td>

          <td>{t.swiftCode}</td>

          <td>{t.beneficiaryDetails || t.recipient}</td>

<td>{t.status || "Pending"}</td>

<td>
  {(t.status === "Pending" || !t.status) && (
    <button onClick={() => verifyTransaction(t.id)}>
      Verify
    </button>
  )}

  {t.status === "Verified" && (
    <button onClick={() => submitToSwift(t.id, t.status)}>
      Submit to SWIFT
    </button>
  )}
</td>

<td>
  {t.createdAt?.toDate
    ? t.createdAt.toDate().toLocaleString()
    : "N/A"}
</td>
        </tr>
      ))}
    </tbody>
  </table>
</>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;