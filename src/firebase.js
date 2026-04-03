// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: GANTI KODE DI BAWAH INI DENGAN CONFIG MILIK ANDA DARI FIREBASE CONSOLE!
const firebaseConfig = {
  apiKey: "AIzaSyBx21_4nlHK9GAlha-pH_M_WsYfzRmmmE8",
  authDomain: "geovisit-ops.firebaseapp.com",
  projectId: "geovisit-ops",
  storageBucket: "geovisit-ops.firebasestorage.app",
  messagingSenderId: "655732503956",
  appId: "1:655732503956:web:974b0b1a003e103681cb81"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);

// Inisialisasi Firestore Database
export const db = getFirestore(app);