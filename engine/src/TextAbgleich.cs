// Werkbank.TextAbgleich: Abstand und Ähnlichkeit zweier Texte für die Suche in
// OCR-Ergebnissen. In C#, weil die Engine je Bildschirm einige hundert
// Vergleiche rechnet und eine Schleife in PowerShell dafür zu langsam ist.
using System;

namespace Werkbank
{
    public static class TextAbgleich
    {
        /// <summary>Levenshtein-Abstand: Einfügen, Löschen, Ersetzen je 1.</summary>
        public static int Abstand(string a, string b)
        {
            if (a.Length == 0) return b.Length;
            if (b.Length == 0) return a.Length;
            var vorher = new int[b.Length + 1];
            var jetzt = new int[b.Length + 1];
            for (int j = 0; j <= b.Length; j++) vorher[j] = j;
            for (int i = 1; i <= a.Length; i++)
            {
                jetzt[0] = i;
                for (int j = 1; j <= b.Length; j++)
                {
                    int kosten = a[i - 1] == b[j - 1] ? 0 : 1;
                    jetzt[j] = Math.Min(Math.Min(jetzt[j - 1] + 1, vorher[j] + 1), vorher[j - 1] + kosten);
                }
                var tausch = vorher;
                vorher = jetzt;
                jetzt = tausch;
            }
            return vorher[b.Length];
        }

        /// <summary>1 heisst gleich, 0 heisst nichts gemeinsam.</summary>
        public static double Aehnlichkeit(string a, string b)
        {
            int laenge = Math.Max(a.Length, b.Length);
            if (laenge == 0) return 1.0;
            return 1.0 - (double)Abstand(a, b) / laenge;
        }

        /// <summary>Ersetzt Zeichen, die eine OCR mit Ziffern verwechselt.
        /// Beide Seiten eines Vergleichs gehen durch dieselbe Ersetzung.</summary>
        public static string Ziffern(string s)
        {
            var zeichen = s.ToCharArray();
            for (int i = 0; i < zeichen.Length; i++)
            {
                switch (zeichen[i])
                {
                    case 'o': zeichen[i] = '0'; break;
                    case 'i':
                    case 'l':
                    case '|':
                    case '!': zeichen[i] = '1'; break;
                    case 's': zeichen[i] = '5'; break;
                    case 'b': zeichen[i] = '8'; break;
                    case 'z': zeichen[i] = '2'; break;
                }
            }
            return new string(zeichen);
        }
    }
}
