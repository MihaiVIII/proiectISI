/*
  Copyright 2019 Esri
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  OnDestroy
} from "@angular/core";

import esri = __esri; // Esri TypeScript Types

import { Subscription } from "rxjs";
import { FirebaseService, IFeedback, IHistory, ITestItem } from "src/app/services/database/firebase";
import { FirebaseMockService } from "src/app/services/database/firebase-mock";
import Search from '@arcgis/core/widgets/Search';
import Config from '@arcgis/core/config';
import WebMap from '@arcgis/core/WebMap';
import MapView from '@arcgis/core/views/MapView';
import Compass from "@arcgis/core/widgets/Compass.js";

import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import * as route from "@arcgis/core/rest/route.js";
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import RouteParameters from '@arcgis/core/rest/support/RouteParameters';
import FeatureSet from '@arcgis/core/rest/support/FeatureSet';
import { features } from "process";

@Component({
  selector: "app-esri-map",
  templateUrl: "./esri-map.component.html",
  styleUrls: ["./esri-map.component.scss"]
})
export class EsriMapComponent implements OnInit, OnDestroy {
  // The <div> where we will place the map
  @ViewChild("mapViewNode", { static: true }) private mapViewEl: ElementRef;

  // Instances
  map: esri.Map;
  view: esri.MapView;
  pointGraphic: esri.Graphic;
  graphicsLayer: esri.GraphicsLayer;

  // Attributes
  zoom = 5;
  center: Array<number> = [25.9727299,45.8390366];
  basemap = "streets-vector";
  loaded = false;
  pointCoords: number[] = [25.9727299,45.8390366];
  dir: number = 0;
  count: number = 0;
  timeoutHandler = null;

  // firebase sync
  isConnected: boolean = false;
  subscriptionList: Subscription;
  subscriptionObj: Subscription;
  isLogedin: boolean = false;

  listFeatureLayer1 = [];
  listFeatureLayer2 = [];
  mode = 0;

  history = null;

  mode2 = 0;
  mode3 = 0;
  mode4 = 0;

  feedbackuid = ""

  constructor(
    private fbs: FirebaseService
    //private fbs: FirebaseMockService
  ) { }

  async initializeMap() {
    try {

      // Configure the Map
      const mapProperties: esri.WebMapProperties = {
        basemap: this.basemap
      };

      Config.apiKey = "AAPKb4d68324dd564729be2e61c02cdde7b8GsVR-udGtBc8dA5H2IVarUMMU0JDbdEfnY2HkuI5oaZCokZoaXT0ezpV-0lyKXnT";

      this.map = new WebMap(mapProperties);

      this.addFeatureLayers();
      this.addGraphicLayers();

      // Initialize the MapView
      const mapViewProperties = {
        container: this.mapViewEl.nativeElement,
        center: this.center,
        zoom: this.zoom,
        map: this.map
      };

      this.view = new MapView(mapViewProperties);
      
      const search = new Search({  //Add Search widget
        view: this.view
      });
      
      var ptr = this;
      search.on("search-complete",function(event)
      {
        var str = event.results[0].results[0].name;
        console.log(str);
        ptr.fbs.addHistoryItem(str);
        if (ptr.history) 
        {
          ptr.view.ui.remove(ptr.history);
          ptr.history = null;
        }
      });

      search.on("search-focus",function(event)
      {
        ptr.view.ui.empty("bottom-right");
        if (ptr.history) 
        {
          ptr.view.ui.remove(ptr.history);
          ptr.history = null;
          return;
        }
        ptr.fbs.getUserHistory().subscribe((items: IHistory[]) => {
          if(items.length > 0)
          {
            console.log("got new items from list: ", items);
            
            const directions: any = document.createElement("ol");
            directions.classList = "esri-widget esri-widget--panel esri-directions__scroller";
            directions.style.marginTop = "20";
            directions.style.padding = "15px 15px 15px 15px";
            directions.style.width = "240px";
            const aux = document.createElement("label");
            aux.innerHTML = "History";
            directions.appendChild(aux);  
            items.forEach((item:IHistory) => {
              const direction = document.createElement("li");
              direction.innerHTML = item.searched;

              var del = document.createElement("button");
              del.innerHTML = "X"
              del.addEventListener("click",function()
              {
                search.search(item.searched);
              })
              direction.appendChild(del);
              directions.appendChild(direction);
            });
            ptr.view.ui.empty("bottom-right");
            if (ptr.history) 
            {
              ptr.view.ui.remove(ptr.history);
              ptr.history = null;
            }
            ptr.view.ui.add(directions, "top-right");
            ptr.history = directions;
          }
          
        });
         
      });

      this.view.ui.add(search, "top-right");
      
      const compassWidget = new Compass({
        view: this.view
      });
      
      // Add the Compass widget to the top left corner of the view
      this.view.ui.add(compassWidget, "top-left");

      // Fires `pointer-move` event when user clicks on "Shift"
      // key and moves the pointer on the view.
      this.view.on('pointer-move', ["Shift"], (event) => {
        let point = this.view.toMap({ x: event.x, y: event.y });
        console.log("map moved: ", point.longitude, point.latitude);
      });

      this.addRouter();
      console.log("??????");

      await this.view.when(); // wait for map to load
      console.log("ArcGIS map loaded");
      console.log("Map center: " + this.view.center.latitude + ", " + this.view.center.longitude);
      return this.view;
    } catch (error) {
      console.log("EsriLoader: ", error);
    }
    
  }

  addGraphicLayers() {
    this.graphicsLayer = new GraphicsLayer();
    this.map.add(this.graphicsLayer);
  }

  //adds feature layers
  addFeatureLayers() 
  {
    const popupProtAreas = {
      "title": "Arie protejata",
      "content": "<b>Nume:</b> {text}<br><b>designatie:</b> {designat_1}"
    }

    const ProtectedAreas = new FeatureLayer({
      url: "https://services7.arcgis.com/kQuO3qStpVmAjEid/arcgis/rest/services/AriiProtejateRomania/FeatureServer",
      outFields: ["gml_id","localID","namespace","designatio","designat_1","percentage","language","text","script"],
      popupTemplate: popupProtAreas
    });
    this.map.add(ProtectedAreas);
    ProtectedAreas.opacity = 0.3;
    this.listFeatureLayer1.push(ProtectedAreas);
    this.listFeatureLayer1.push(0.3);

    var ptr = this;
    const popupSimple = {
      "title": "Monument istoric",
      "content": "<b>Nume:</b>{name}"
    }

    const turism_layer = new FeatureLayer({
      url: "https://services7.arcgis.com/v0CEu87DMHNQuNtr/arcgis/rest/services/Turism/FeatureServer/0",
      popupTemplate: popupSimple,
      outFields:["*"]
    });
    this.map.add(turism_layer);
    this.listFeatureLayer1.push(turism_layer);
    this.listFeatureLayer1.push(1);

    const turism_layer2 = new FeatureLayer({
      url: "https://services7.arcgis.com/v0CEu87DMHNQuNtr/arcgis/rest/services/Turism/FeatureServer/1",
      popupTemplate: popupSimple,
      outFields:["*"]
    });
    this.map.add(turism_layer2);
    this.listFeatureLayer1.push(turism_layer2);
    this.listFeatureLayer1.push(1);

    const turism_layer3 = new FeatureLayer({
      url: "https://services7.arcgis.com/v0CEu87DMHNQuNtr/arcgis/rest/services/Turism/FeatureServer/2",
      popupTemplate: popupSimple,
      outFields:["*"]
    });
    this.map.add(turism_layer3);
    this.listFeatureLayer1.push(turism_layer3);
    this.listFeatureLayer1.push(1);

    const popupANatural = {
      "title": "Atractie naturala",
      "content":"<b>Nume:</b> {name}<br><b>Adresa:</b> {formatted_address}<br><b>Rating:</b> {rating}<br><b>Url:</b> {url}"
    }

    const natural_layer = new FeatureLayer({
      url: "https://services8.arcgis.com/BBQ8y8wlr7sbDPZa/arcgis/rest/services/atractii_naturale/FeatureServer",
      outFields:["business_status","formatted_address","name","place_id","rating","types","permanently_closed","price_level","url"],
      popupTemplate:popupANatural
    });
    this.map.add(natural_layer);    
    this.listFeatureLayer1.push(natural_layer);
    this.listFeatureLayer1.push(1);

    //graphich layer 2
    const Renderer1 = {
      "type": "simple",
      "symbol": {
        "type": "picture-marker",
        "url": "http://localhost:4200/assets/Restauramt.png",
        "width": "24px",
        "height": "24px"
      }
    }
    
    const Renderer2 = {
      "type": "simple",
      "symbol": {
        "type": "picture-marker",
        "url": "http://localhost:4200/assets/Sleep.png",
        "width": "24px",
        "height": "24px"
      }
    }

    const Renderer3 = {
      "type": "simple",
      "symbol": {
        "type": "picture-marker",
        "url": "http://localhost:4200/assets/1024px-Star_of_life2.svg.png",
        "width": "24px",
        "height": "24px"
      }
    }

    const benzinarii = new FeatureLayer({
      url: "https://services9.arcgis.com/HV2pGmqrtzvagcSy/arcgis/rest/services/BezinariiPublic/FeatureServer",
    });
    this.map.add(benzinarii);    
    benzinarii.opacity = 0;
    this.listFeatureLayer2.push(benzinarii);
    this.listFeatureLayer2.push(1);

    const restaurante = new FeatureLayer({
      url: "https://services8.arcgis.com/BBQ8y8wlr7sbDPZa/arcgis/rest/services/restaurante_bune_romania/FeatureServer",
      renderer: Renderer1 as esri.RendererProperties
    });
    this.map.add(restaurante);    
    restaurante.opacity = 0;
    this.listFeatureLayer2.push(restaurante);
    this.listFeatureLayer2.push(1)

    const hoteluri = new FeatureLayer({
      url: "https://services7.arcgis.com/v0CEu87DMHNQuNtr/arcgis/rest/services/Unitati_cazare/FeatureServer/0",
      renderer: Renderer2 as esri.RendererProperties
    });
    this.map.add(hoteluri);    
    hoteluri.opacity = 0;
    this.listFeatureLayer2.push(hoteluri);
    this.listFeatureLayer2.push(1)

    const cazari = new FeatureLayer({
      url: "https://services7.arcgis.com/v0CEu87DMHNQuNtr/arcgis/rest/services/Unitati_cazare/FeatureServer/1",
      renderer: Renderer2 as esri.RendererProperties
    });
    this.map.add(cazari);    
    cazari.opacity = 0;
    this.listFeatureLayer2.push(cazari);
    this.listFeatureLayer2.push(1)

    const spitale = new FeatureLayer({
      url: "https://services7.arcgis.com/hOPhvDvk6mK5epOl/arcgis/rest/services/spitale/FeatureServer",
      renderer: Renderer3 as esri.RendererProperties
    });
    this.map.add(spitale);    
    spitale.opacity = 0;
    this.listFeatureLayer2.push(spitale);
    this.listFeatureLayer2.push(1)


  }

  addPoint(lat: number, lng: number, register: boolean, coloor: [number,number,number]) {  
    let point = new Point({
      longitude: lng,
      latitude: lat
    });

    const simpleMarkerSymbol = {
      type: "simple-marker",
      color: coloor,  // Orange
      outline: {
        color: [255, 255, 255], // White
        width: 1
      }
    };
    let pointGraphic: esri.Graphic = new Graphic({
      geometry: point,
      symbol: simpleMarkerSymbol
    });

    this.graphicsLayer.add(pointGraphic);
    if (register) {
      this.pointGraphic = pointGraphic;
    }
  }

  removePoint() {
    if (this.pointGraphic != null) {
      this.graphicsLayer.remove(this.pointGraphic);
    }
  }

  runTimer() {
    this.timeoutHandler = setTimeout(() => {
      // code to execute continuously until the view is closed
      // ...
      this.runTimer();
    }, 200);
  }

  stopTimer() {
    if (this.timeoutHandler != null) {
      clearTimeout(this.timeoutHandler);
      this.timeoutHandler = null;
    }
  }

  connectFirebase() {
    if (this.isConnected) {
      return;
    }
    this.isConnected = true;
    this.fbs.connectToDatabase();
    this.subscriptionList = this.fbs.getChangeFeedList().subscribe((items: ITestItem[]) => {
      console.log("got new items from list: ", items);
      this.graphicsLayer.removeAll();
      for (let item of items) {
        this.addPoint(item.lat, item.lng, false,item.color);
      }
    });
    this.subscriptionObj = this.fbs.getChangeFeedObj().subscribe((stat: ITestItem[]) => {
      console.log("item updated from object: ", stat);
    });
  }

  addPointItem() {
    var colorPicker = <HTMLInputElement>document.getElementById('favcolor');
    var color = colorPicker.value;
    var colorrgb = this.hextorgb(color);
    console.log("Map center: " + this.view.center.latitude + ", " + this.view.center.longitude + ',color=' + colorrgb);
    this.fbs.addPointItem(this.view.center.latitude, this.view.center.longitude,colorrgb);
  }

  addRouter() {
    const routeUrl = "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World";

    this.view.on("click", (event) => {
      this.view.ui.empty("bottom-left");
      console.log("point clicked: ", event.mapPoint.latitude, event.mapPoint.longitude);
      if (this.mode2) {
        var colorPicker = <HTMLInputElement>document.getElementById('favcolor');
        var color = colorPicker.value;
        var colorrgb = this.hextorgb(color);
        this.fbs.addPointItem(event.mapPoint.latitude, event.mapPoint.longitude,colorrgb);
      }
      else if (this.mode3) {
        if (this.view.graphics.length === 0) {
          addGraphic("origin", event.mapPoint);
        } else if (this.view.graphics.length === 1) {
          addGraphic("destination", event.mapPoint);
          getRoute(); // Call the route service
        } else {
          this.view.graphics.removeAll();
          this.view.ui.empty("bottom-right");
          addGraphic("origin", event.mapPoint);
        }
      }
      else if (this.mode4) 
      { var ptr = this;
        var screenpoint = 
        {
          x:event.x,
          y:event.y
        };
        this.view.hitTest(screenpoint).then(function (response){
          if(response.results.length > 0)
          {
            const aux = response.results[0];
            
            console.log(aux);
            if(aux.layer.type === "feature")
            {
              ptr.handleLayerClick(aux,ptr);
            }
          }
        }) 
      }
      else
      {
        var ptr = this;
        var screenpoint = 
        {
          x:event.x,
          y:event.y
        };
        this.view.hitTest(screenpoint).then(function (response){
          if(response.results.length > 0)
          {
            const aux = response.results[0];
            
            console.log(aux);
            if(aux.layer.type === "feature")
            {
              ptr.handleLayerClick2(aux,ptr);
            }
          }
        }) 
      }
    });

    var addGraphic = (type: any, point: any) => {
      const graphic = new Graphic({
        symbol: {
          type: "simple-marker",
          color: (type === "origin") ? "white" : "black",
          size: "8px"
        } as any,
        geometry: point
      });
      this.view.graphics.add(graphic);
    }

    var getRoute = () => {
      const routeParams = new RouteParameters({
        stops: new FeatureSet({
          features: this.view.graphics.toArray()
        }),
        returnDirections: true
      });

      route.solve(routeUrl, routeParams).then((data: any) => {
        for (let result of data.routeResults) {
          result.route.symbol = {
            type: "simple-line",
            color: [5, 150, 255],
            width: 3
          };
          this.view.graphics.add(result.route);
        }

        // Display directions
        if (data.routeResults.length > 0) {
          const directions: any = document.createElement("ol");
          directions.classList = "esri-widget esri-widget--panel esri-directions__scroller";
          directions.style.marginTop = "0";
          directions.style.padding = "15px 15px 15px 30px";
          const features = data.routeResults[0].directions.features;

          let sum = 0;
          // Show each direction
          features.forEach((result: any, i: any) => {
            sum += parseFloat(result.attributes.length);
            const direction = document.createElement("li");
            direction.innerHTML = result.attributes.text + " (" + result.attributes.length + " miles)";
            directions.appendChild(direction);
          });

          sum = sum * 1.609344;
          console.log('dist (km) = ', sum);
          this.view.ui.empty("bottom-right");
          this.view.ui.add(directions, "bottom-right");
        }
      }).catch((error: any) => {
        console.log(error);
      });
    }
  }

  disconnectFirebase() {
    if (this.subscriptionList != null) {
      this.subscriptionList.unsubscribe();
    }
    if (this.subscriptionObj != null) {
      this.subscriptionObj.unsubscribe();
    }
  }

  ngOnInit() {
    // Initialize MapView and return an instance of MapView
    console.log("initializing map");
    this.initializeMap().then(() => {
      // The map has been initialized
      console.log("mapView ready: ", this.view.ready);
      this.loaded = this.view.ready;
      this.runTimer();
    });
  }

  ngOnDestroy() {
    if (this.view) {
      // destroy the map view
      this.view.container = null;
    }
    this.stopTimer();
    this.disconnectFirebase();
  }

  openForm() {
    console.log("OPEN");
    document.getElementById("myForm").style.display = "block";
  }
    
  closeForm() {
    console.log("CLOSE");
    document.getElementById("myForm").style.display = "none";
  }

  login()
  {
    if(!this.isLogedin)
    {
      console.log("login");
      var username = (<HTMLInputElement>document.getElementById("email")).value;
      var passwd = (<HTMLInputElement>document.getElementById("psw")).value;
      this.fbs.signin(username,passwd,this.todoAfter,this);
    }
  }

  signup()
  {
    if(!this.isLogedin)
    {
      console.log("signup");
      var username = (<HTMLInputElement>document.getElementById("email")).value;
      var passwd = (<HTMLInputElement>document.getElementById("psw")).value;
      this.fbs.signup(username,passwd,this.todoAfter,this);      
    }
  }

  todoAfter(ptr)
  {
    ptr.closeForm();
    ptr.isLogedin = true;
    ptr.connectFirebase();
  }

  switchMapView()
  {
    var i = 0;
    this.mode = 1 - this.mode;
    
    for(i = 0; i < this.listFeatureLayer1.length;i+=2)
    {

      if (this.mode == 0)
      {
        this.listFeatureLayer1[i].opacity = this.listFeatureLayer1[i+ 1];  
      }
      else
      {
        this.listFeatureLayer1[i].opacity = 0;
      }
    }

    for(i = 0; i < this.listFeatureLayer2.length;i+=2)
    {
      if (this.mode == 1)
      {
        this.listFeatureLayer2[i].opacity = this.listFeatureLayer2[i + 1];
        this.listFeatureLayer2[i].labelingInfo = [this.getlabels() as esri.LabelClassProperties]  
      }
      else
      {
        this.listFeatureLayer2[i].opacity = 0;
        this.listFeatureLayer2[i].labelingInfo = [];
      }
    }
  }

  getlabels()
  {
    const headsLabels = {
      symbol: {
        type: "text",
        color: "#FFFFFF",
        haloColor: "#5E8D74",
        haloSize: "2px",
        font: {
          size: "12px",
          family: "Noto Sans",
          style: "italic",
          weight: "normal"
        }
      },

      labelPlacement: "above-center",
      labelExpressionInfo: {
        expression: "$feature.NAME"
      },
      minScale:80000,
      maxScale:500
    };
    return headsLabels;
  }

  hextorgb(string:string)
  {
    string = string.replace(/^#/,'');
    var int = parseInt(string,16);
    return <[number,number,number]>[(int >> 16) & 255,(int >> 8) & 255,int & 255]
  }

  clearPoints()
  {
    this.fbs.clearpoints();
  }

  swPointmode()
  {
    this.mode2 = 1 - this.mode2;
    this.mode3 = 0;
    this.view.ui.empty("bottom-right"); 
  }

  swRoutemode()
  {
    this.mode3 = 1 - this.mode3;
    this.mode2 = 0;
    this.view.ui.empty("bottom-right");
  }

  clearRoute()
  {
    this.view.graphics.removeAll();
    this.view.ui.empty("bottom-right");
  }

  sendFeedback()
  {
    this.mode4 = 1 - this.mode4;
  }

  handleLayerClick(aux:esri.ViewHit,ptr)
  {
    if (aux.layer.title == "Atractii naturale points") {
      if ('graphic' in aux)
      {
        var aux2 = aux.graphic.attributes;
        if ('place_id' in aux2) 
        {
          console.log(aux2.place_id);
          ptr.feedbackuid =  aux2.place_id;
          ptr.openForm2(aux2.name);
        }
      }
    }
    if (aux.layer.title == "Turism points")
    {
      if ('graphic' in aux)
      {
        var aux2 = aux.graphic.attributes;
        console.log(aux2);
        if ('F_id' in aux2) 
        {
          console.log(aux2.F_id);
          ptr.feedbackuid =  aux2.F_id;
          ptr.openForm2(aux2.name);
        }
      }
    }
  }

  openForm2(str:string) {
    console.log("OPEN");
    document.getElementById("myForm2").style.display = "block";
    document.getElementById("headerfeedback").textContent = "Formular feedback pentru "+ str;
  }
    
  closeForm2() {
    console.log("CLOSE");
    document.getElementById("myForm2").style.display = "none";
    this.mode4 = 0;
  }

  sendFeedbackItem()
  {
    var text = (<HTMLTextAreaElement>document.getElementById("feed")).value;
    this.fbs.addFeedbackItem(text,this.feedbackuid);
    this.closeForm2();
  }

  handleLayerClick2(aux:esri.ViewHit,ptr)
  {
    if (aux.layer.title == "Atractii naturale points") {
      if ('graphic' in aux)
      {
        var aux2 = aux.graphic.attributes;
        if ('place_id' in aux2) 
        {
          console.log(aux2.place_id);
          
          ptr.fbs.getFeedback(aux2.place_id).subscribe((items: IFeedback[]) => {
            if(items.length > 0)
            {
              console.log("got new items from list: ", items);
                
              const directions: any = document.createElement("ol");
              directions.classList = "esri-widget esri-widget--panel esri-directions__scroller";
              directions.style.marginTop = "20";
              directions.style.padding = "15px 15px 15px 15px";
              directions.style.width = "240px";
              const aux = document.createElement("label");
              aux.innerHTML = "Feedback" + aux2.name;
              directions.appendChild(aux);  
              items.forEach((item:IFeedback) => {
                const direction = document.createElement("li");
                direction.innerHTML = item.text;
    
                directions.appendChild(direction);
              });
              ptr.view.ui.empty("bottom-left");

              ptr.view.ui.add(directions, "bottom-left");
            }
          });
        }
      }
    }
    if (aux.layer.title == "Turism points")
    {
      if ('graphic' in aux)
      {
        var aux2 = aux.graphic.attributes;
        console.log(aux2);
        if ('F_id' in aux2) 
        {
          console.log(aux2.F_id);
          ptr.fbs.getFeedback(aux2.F_id).subscribe((items: IFeedback[]) => {
            if(items.length > 0)
            {
              console.log("got new items from list: ", items);
                
              const directions: any = document.createElement("ol");
              directions.classList = "esri-widget esri-widget--panel esri-directions__scroller";
              directions.style.marginTop = "20";
              directions.style.padding = "15px 15px 15px 15px";
              directions.style.width = "240px";
              const aux = document.createElement("label");
              aux.innerHTML = "Feedback " + aux2.name;
              directions.appendChild(aux);  
              items.forEach((item:IFeedback) => {
                const direction = document.createElement("li");
                direction.innerHTML = item.text;
    
                directions.appendChild(direction);
              });
              ptr.view.ui.empty("bottom-left");

              ptr.view.ui.add(directions, "bottom-left");
            }
          });
        }
      }
    }
  }

}

