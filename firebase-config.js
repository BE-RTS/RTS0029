// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBLHw6yeiqeJTtp2O8KDUl7_xu0Dg-sxHM",
  authDomain: "rts00029-5ef6a.firebaseapp.com",
  projectId: "rts00029-5ef6a",
  storageBucket: "rts00029-5ef6a.firebasestorage.app",
  messagingSenderId: "796484288528",
  appId: "1:796484288528:web:ab0d71ea9905a4eb150a95",
  measurementId: "G-J8E5H0MDRM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
