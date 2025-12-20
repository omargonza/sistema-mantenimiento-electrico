from django.core.management.base import BaseCommand
from historial.models import Tablero

TABLEROS = {
  "Gral. Paz – Acceso Norte / La Noria": [
    "TI 1400","TI 1300","TI 1200","TI 1100","TI 1000","TI 900","TI 800",
    "TI 700","TI 600","TI 500","TI 400","TI 300","TI 200","TI 100",
    "TI 47 Provincias Unidas",
    "Tablero Cámara 1","Tablero Cámara 2","Tablero Holmberg",
    "Tuyutí","Ibarrola","Amadeo Jacques","Madrid","San Cayetano",
    "J. J. Paso","San Ignacio","Croacia",
    "TI 1 Nazarre","TI 2 Varela","TI 3 Cortina","TI 4 Molière",
    "TI 5 Calderón de la Barca","TI 6 Lastra","TI 7 Vallejos",
    "TI 8 Lincoln","TI 9 Griveo","TI 10 San Martín","TI 11 Emilio Lamarca",
    "TI 12 Campana","TI 13 Ezeiza","TI 14 Barrio General",
    "TI 15 Parque Saavedra","TI 16 Parque Sarmiento",
    "TI 17 Parque Saavedra 2","TI 18 Lima","TI 19 Tejar",
    "TI 20 Lugones","TI 22 Echeverría","TI 45 Constituyentes"
  ],

  "Estaciones de Peaje": [
    "Peaje Debenedetti Ascendente","Peaje Debenedetti Descendente",
    "Peaje Belgrano Ascendente","Peaje Belgrano Descendente",
    "Peaje Márquez Ascendente","Peaje Márquez Descendente",
    "Peaje Tigre Troncal",
    "Peaje Capitán Juan de San Martín Ascendente",
    "Peaje Capitán Juan de San Martín Descendente",
    "Peaje Camino Real Ascendente","Peaje Camino Real Descendente",
    "Peaje Buen Aire Ascendente","Peaje Buen Aire Descendente",
    "Peaje Buen Aire Decalado Descendente",
    "Peaje 202 Ascendente","Peaje 202 Descendente",
    "Peaje 202 Decalado Ascendente","Peaje 202 Decalado Descendente",
    "Peaje 197 Ascendente","Peaje 197 Descendente",
    "Peaje Campana Troncal","Peaje Campana Decalado",
    "Peaje Pilar Troncal","Peaje Pilar Decalado"
  ],

  "Gral. Paz – Lugones": [
    "TI 40 Superí","TI 40.1 Superí 1","TI 41 Zapiola",
    "TI 42 Cabildo","TI 43 11 de Septiembre","Tab Grecia"
  ],

  "Acceso Norte – Gral. Paz / Márquez": [
    "TAN 01 Venezuela","TI 23 Haedo","TI 24 Arenales","TI 25 Villate",
    "TI 26 Pelliza","Tab Bermúdez","TI 28 Paraná","TI 29 Vélez",
    "TI 30 Cuyo","TI 31 Wilde"
  ],

  "Acceso Norte – Márquez / Bifurcación": [
    "TI 32 Rolón I","TI 33 Rolón II","TI 34 Márquez I","TI 35 Márquez II",
    "Tab Sucre",
    "TG 093 Gardel","TG 099 Carlos Tejedor","TG 099.1 Carlos Tejedor 1",
    "TG 105 Cazón","TG 111 Camino Morón","TG 111.1 Morón 1","TG 111.2 Morón 2",
    "TGBA 01 Valladolid","TGBA 02 Bombay","TGBA 03 Buen Aire",
    "TGBA 04 Apolo","TGBA 05 Ezequiel",
    "TG 134 Lugones","TG 141 Ozanam","TG 147 Boulogne","TG 153 Obligado",
    "TG 159 Belgrano","TG 165 Pacheco","TG 171 Paraguay",
    "TG 177 Reconquista","TG 183 Colombia","TG 189 9 de Julio",
    "TG 195 Bifurcación",
    "TGP 201A Libertador","TGC 207 José Ingenieros","TGSC 207.1 José Ingenieros",
    "TGSP 207 Storni","TGSP 207.1 Storni I","TGC 213 Rosas","TGP 213 Rojas",
    "Ricardo"
  ],

  "Ramal Campana": [
    "TC02 Gutiérrez","TC03 Henry Ford","TC04 Constituyentes",
    "TC05 Ferrocarril Mitre","TC06 Alvear","TC07 Fidel López",
    "TC08 Chilabert","TC09 Vedia","TC10 Ruta 9","TC11 La Bota",
    "TC12 Saavedra","TC13 Maschwitz","TC14 Maipú","TC15 Avellaneda",
    "TC16 A.C.A.","TC17 Horacio","TC18 Aranjuez","TC18.1 El Cantón",
    "TC19 Aranjuez II","TC20 Septiembre","TC21 Mario",
    "TC22 Martín Fierro","TC23 Distribuidor Escobar I",
    "TC24 Distribuidor Escobar II","TC25 Cruz","TC26 Lazaristas",
    "TC27 Dragui","TC28 La Tranquita","TC29 Pecuen","TC30 Fleni",
    "TC31 Shell","TC32 Loma Verde","TC33 Loma Verde II",
    "TC34 Luis","TC35 Daniel","TC36 Transporte","TC37 David",
    "TC38 Cristian","TC39 Río Luján","TC40 Río Luján II",
    "TC41 Camping","TC42 Los Cardales","TC43 Gabriel","TC44 Fernando",
    "TC45 Arroyo Pescado","TC46 Hugo","TC47 Diego","TC48 Marcelo",
    "TC49 La Lucila","TC50 Matías","TC51 Otamendi","TC52 San Jacinto",
    "TC53 Blanco","TC54 Parque Industrial","TC55 El Tanque",
    "TC56 Ariel del Plata","TC57 Barrio Siderca","TC58 Campana"
  ],

  "Pilar": [
    "TP02 Carnot","TP04 Eiffel","TP05 Olivos","TP06 Constituyentes",
    "TP06.1 Patricios","TP07 Santa Rosa","TP07.1 Lugones",
    "TP08 Junín Golf","TP08.1 Tortuguitas","TP09 Ruta 26",
    "TP10 Las Camelias","TP11 Oliden","TP12 De la Torre","TP13 Florida",
    "TP14 Los Lagartos","TP16 Chile","TP17 Saraví","TP18 Chacabuco",
    "TP19 Güemes","TP20 Las Magnolias","TP21 Riccieri","TP22 Argerich",
    "TP23 Guido","TP24 RP N°25","TP25 Santa María","TP26 San Martín",
    "TP27 J. J. Paso","TP28 Río de Janeiro","TP29 Bragado","TP30 Pilar"
  ],

  "Tigre": [
    "TT1 Blanco Encalada","TT2 Tomkinson","TT3 Guido","TT4 Uruguay",
    "TT5 Carlos Casares","TT6 Avellaneda","TT7 Ruta 202","TT8 Shell",
    "TT9 Carupá","TT10 Tigre Centro","TT11 Tigre Joven",
    "TT12 Punto 12","TT13 Tigre"
  ]
}
 # ← pegar el dict completo de arriba

class Command(BaseCommand):
    help = "Carga normalizada de tableros por zona (idempotente)"

    def handle(self, *args, **kwargs):
        creados = 0
        for zona, lista in TABLEROS.items():
            for nombre in lista:
                _, created = Tablero.objects.get_or_create(
                    nombre=nombre,
                    defaults={"zona": zona}
                )
                if created:
                    creados += 1
        self.stdout.write(self.style.SUCCESS(
            f"Tableros procesados OK. Nuevos creados: {creados}"
        ))
