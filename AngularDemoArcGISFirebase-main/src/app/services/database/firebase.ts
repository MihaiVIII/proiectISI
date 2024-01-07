import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable } from 'rxjs';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Address } from 'cluster';

export interface ITestItem {
    name: string,
    lat: number,
    lng: number,
    user: string
    color: [number,number,number]
}

export interface IHistory {
    searched: string,
    user:string;
}

export interface IFeedback {
    text:string,
    uuid:string
}

@Injectable()
export class FirebaseService {

    listFeed: Observable<any[]>;
    objFeed: Observable<any>;
    
    user = "";

    constructor(public db: AngularFireDatabase,public auth: AngularFireAuth) {

    }

    connectToDatabase() {
        this.listFeed = this.db.list('list1',ref => ref.orderByChild('user').equalTo(this.user)).valueChanges();
        this.objFeed = this.db.object('obj').valueChanges();
    }

    getChangeFeedList() {
        return this.listFeed;
    }

    getChangeFeedObj() {
        return this.objFeed;
    }

    addPointItem(lat: number, lng: number, color: [number,number,number]) {
        let item: ITestItem = {
            name: "test",
            lat: lat,
            lng: lng,
            user: this.user,
            color: color
        };
        this.db.list('list1').push(item);
    }

    syncPointItem(lat: number, lng: number,color: [number,number,number]) {
        let item: ITestItem = {
            name: "test",
            lat: lat,
            lng: lng,
            user: "",
            color: color
        };
        this.db.object('obj').set([item]);
    }

    signup(email:string,password:string,after:Function,ptr) 
    {   
        this.auth.createUserWithEmailAndPassword(email,password)
        .then((userCredential) => 
        {
            // Signed up 
            const user = userCredential.user;
            this.user = user.uid;
            console.log('User signed out',userCredential.user);
            after(ptr);
        })
        .catch((error) => 
        {
            const errorCode = error.code;
            const errorMessage = error.message;
        });
    }

    signin(email:string,password:string,after:Function,ptr)
    {
        this.auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Signed in 
            const user = userCredential.user;
            this.user = user.uid;
            console.log('User signedin',userCredential.user);
            after(ptr);
            // ...
        })
        .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
        });
    }

    addHistoryItem(str: string) {
        if (this.user == "") 
        {
            return;
        }
        let item: IHistory = {
            searched: str,
            user: this.user
        };
        this.db.list('history').push(item);
    }

    getUserHistory()
    {
        return this.db.list('history',ref => ref.orderByChild('user').equalTo(this.user)).valueChanges();
    }

    clearpoints()
    {
        var aux = this.db.list('list1',ref => ref.orderByChild('user').equalTo(this.user));
        var sub = aux.snapshotChanges().subscribe((snapshot) => {
            snapshot.forEach((item) => {
              console.log(snapshot)
              console.log(item)
              const key = item.key;
              if (key) {
                aux.remove(key);
                console.log(`Item with deleted`);
              }
              sub.unsubscribe();
            });
          }, error => {
            console.error('Error deleting items:', error);
          });
    }

    addFeedbackItem(text: string,uid:string) {
        let item: IFeedback = {
            text: text,
            uuid: uid
        };
        this.db.list('feedback').push(item);
    }

    getFeedback(uid:string)
    {
        return this.db.list('feedback',ref => ref.orderByChild('uuid').equalTo(uid)).valueChanges();
    }

}
