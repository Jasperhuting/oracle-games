import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "../firebase/client";

export const listenTranslations = (locale: string, callback: (data: any) => void) => {
  console.log(`Setting up Firestore listener for locale: ${locale}`);
  const ref = doc(db, "translations", locale);

  // Eerst direct ophalen
  getDoc(ref).then((doc) => {
    if (doc.exists()) {
      console.log('Initial translations loaded from Firestore');
      callback(doc.data() || {});
    } else {
      console.warn(`No translations found for locale: ${locale}`);
      callback({});
    }
  }).catch((error) => {
    console.error('Error loading translations:', error);
    callback({});
  });

  // Dan luisteren naar updates
  const unsubscribe = onSnapshot(
    ref,
    (snapshot) => {
      if (snapshot.exists()) {
        console.log('Received translation update from Firestore');
        callback(snapshot.data() || {});
      } else {
        console.warn(`No document found for locale: ${locale}`);
        callback({});
      }
    },
    (error) => {
      console.error('Error listening to translations:', error);
      // Blijf luisteren, maar geef lege objecten door
      callback({});
    }
  );

  return () => {
    console.log('Cleaning up Firestore listener');
    unsubscribe();
  };
};