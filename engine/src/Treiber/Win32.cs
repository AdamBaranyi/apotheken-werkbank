// Werkbank.Win32: Fenster finden und nach vorne holen, Klicks und Tasten über
// SendInput. SendInput statt SendKeys: SendKeys schreibt in das Fenster, das in
// diesem Moment den Fokus hat, und verliert Zeichen bei einem Fokuswechsel;
// SendInput meldet zurück, ob das System die Eingabe angenommen hat.
//
// Koordinaten sind echte Bildschirmpixel, sobald DpiBewusst() gelaufen ist.
// Fenster liefern ihre Client-Fläche (ohne Titelleiste und Rahmen), weil die
// Engine nur diese fotografiert und darin rechnet.
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace Werkbank
{
    public sealed class FensterInfo
    {
        public IntPtr Handle;
        public string Titel;
        public int X;
        public int Y;
        public int Breite;
        public int Hoehe;
    }

    public static class Win32
    {
        [StructLayout(LayoutKind.Sequential)]
        private struct RECT { public int Left, Top, Right, Bottom; }

        [StructLayout(LayoutKind.Sequential)]
        private struct POINT { public int X, Y; }

        [StructLayout(LayoutKind.Sequential)]
        private struct MOUSEINPUT
        {
            public int dx;
            public int dy;
            public uint mouseData;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct KEYBDINPUT
        {
            public ushort wVk;
            public ushort wScan;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Explicit)]
        private struct EINGABE
        {
            [FieldOffset(0)] public MOUSEINPUT mi;
            [FieldOffset(0)] public KEYBDINPUT ki;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct INPUT
        {
            public uint type;
            public EINGABE u;
        }

        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
        [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr h);
        [DllImport("user32.dll")] private static extern bool GetClientRect(IntPtr h, out RECT r);
        [DllImport("user32.dll")] private static extern bool ClientToScreen(IntPtr h, ref POINT p);
        [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr h);
        [DllImport("user32.dll")] private static extern bool BringWindowToTop(IntPtr h);
        [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr h, int nCmdShow);
        [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr h);
        [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr pid);
        [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
        [DllImport("user32.dll")] private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
        [DllImport("user32.dll")] private static extern bool SetCursorPos(int x, int y);
        [DllImport("user32.dll", SetLastError = true)] private static extern uint SendInput(uint n, INPUT[] inputs, int size);
        [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr value);
        [DllImport("user32.dll")] private static extern uint GetDpiForWindow(IntPtr h);
        [DllImport("user32.dll")] private static extern int GetSystemMetrics(int index);

        private const uint INPUT_MOUSE = 0;
        private const uint INPUT_KEYBOARD = 1;
        private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        private const uint MOUSEEVENTF_LEFTUP = 0x0004;
        private const uint KEYEVENTF_KEYUP = 0x0002;
        private const uint KEYEVENTF_UNICODE = 0x0004;
        private const int SW_RESTORE = 9;

        /// <summary>DPI-Bewusstsein pro Monitor (V2): Koordinaten in echten Pixeln.
        /// Muss vor dem ersten Fenster und dem ersten Bildschirmfoto laufen;
        /// false heisst meist, dass der Prozess schon festgelegt war.</summary>
        public static bool DpiBewusst()
        {
            return SetProcessDpiAwarenessContext(new IntPtr(-4));
        }

        public static uint Dpi(IntPtr h)
        {
            return GetDpiForWindow(h);
        }

        public static int[] Bildschirm()
        {
            return new[] { GetSystemMetrics(0), GetSystemMetrics(1) };
        }

        /// <summary>Sichtbare Fenster, deren Titel den Text enthält.</summary>
        public static List<FensterInfo> Suchen(string titelteil)
        {
            var treffer = new List<FensterInfo>();
            EnumWindows((h, l) =>
            {
                if (!IsWindowVisible(h)) return true;
                var info = Info(h);
                if (info.Titel.Length > 0 &&
                    info.Titel.IndexOf(titelteil, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    treffer.Add(info);
                }
                return true;
            }, IntPtr.Zero);
            return treffer;
        }

        /// <summary>Alle sichtbaren Fenster mit Titel, für die Fehlersuche.</summary>
        public static List<string> Titel()
        {
            var titel = new List<string>();
            EnumWindows((h, l) =>
            {
                if (!IsWindowVisible(h)) return true;
                var t = Info(h).Titel;
                if (t.Length > 0) titel.Add(t);
                return true;
            }, IntPtr.Zero);
            return titel;
        }

        public static FensterInfo Info(IntPtr h)
        {
            var text = new StringBuilder(512);
            GetWindowText(h, text, text.Capacity);
            RECT r;
            GetClientRect(h, out r);
            var p = new POINT();
            ClientToScreen(h, ref p);
            return new FensterInfo
            {
                Handle = h,
                Titel = text.ToString(),
                X = p.X,
                Y = p.Y,
                Breite = r.Right - r.Left,
                Hoehe = r.Bottom - r.Top,
            };
        }

        public static IntPtr Vorne()
        {
            return GetForegroundWindow();
        }

        /// <summary>Holt das Fenster nach vorne. Windows erlaubt das nur dem
        /// Prozess, der gerade vorne ist; darum hängt sich der Aufruf kurz an
        /// dessen Eingabe-Thread.</summary>
        public static bool Vordergrund(IntPtr h)
        {
            if (IsIconic(h)) ShowWindow(h, SW_RESTORE);
            IntPtr vorne = GetForegroundWindow();
            if (vorne == h) return true;
            uint ich = GetCurrentThreadId();
            uint dort = vorne == IntPtr.Zero ? 0 : GetWindowThreadProcessId(vorne, IntPtr.Zero);
            bool verbunden = dort != 0 && dort != ich && AttachThreadInput(ich, dort, true);
            try
            {
                BringWindowToTop(h);
                SetForegroundWindow(h);
            }
            finally
            {
                if (verbunden) AttachThreadInput(ich, dort, false);
            }
            return GetForegroundWindow() == h;
        }

        public static bool Klick(int x, int y)
        {
            if (!SetCursorPos(x, y)) return false;
            var e = new INPUT[2];
            e[0].type = INPUT_MOUSE;
            e[0].u.mi.dwFlags = MOUSEEVENTF_LEFTDOWN;
            e[1].type = INPUT_MOUSE;
            e[1].u.mi.dwFlags = MOUSEEVENTF_LEFTUP;
            return Senden(e);
        }

        /// <summary>Tippt Zeichen als Unicode, unabhängig vom Tastaturlayout.</summary>
        public static bool Tippen(string text)
        {
            foreach (char c in text)
            {
                var e = new INPUT[2];
                e[0].type = INPUT_KEYBOARD;
                e[0].u.ki.wScan = c;
                e[0].u.ki.dwFlags = KEYEVENTF_UNICODE;
                e[1].type = INPUT_KEYBOARD;
                e[1].u.ki.wScan = c;
                e[1].u.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
                if (!Senden(e)) return false;
                Thread.Sleep(12);
            }
            return true;
        }

        /// <summary>Drückt eine Taste über ihren virtuellen Code (Enter 0x0D).</summary>
        public static bool Taste(ushort vk)
        {
            var e = new INPUT[2];
            e[0].type = INPUT_KEYBOARD;
            e[0].u.ki.wVk = vk;
            e[1].type = INPUT_KEYBOARD;
            e[1].u.ki.wVk = vk;
            e[1].u.ki.dwFlags = KEYEVENTF_KEYUP;
            return Senden(e);
        }

        /// <summary>Drückt eine Taste mit gehaltener Umschalttaste (Umschalt+Tab).</summary>
        public static bool TasteMitUmschalt(ushort vk)
        {
            const ushort VK_SHIFT = 0x10;
            var e = new INPUT[4];
            e[0].type = INPUT_KEYBOARD;
            e[0].u.ki.wVk = VK_SHIFT;
            e[1].type = INPUT_KEYBOARD;
            e[1].u.ki.wVk = vk;
            e[2].type = INPUT_KEYBOARD;
            e[2].u.ki.wVk = vk;
            e[2].u.ki.dwFlags = KEYEVENTF_KEYUP;
            e[3].type = INPUT_KEYBOARD;
            e[3].u.ki.wVk = VK_SHIFT;
            e[3].u.ki.dwFlags = KEYEVENTF_KEYUP;
            return Senden(e);
        }

        private static bool Senden(INPUT[] e)
        {
            return SendInput((uint)e.Length, e, Marshal.SizeOf(typeof(INPUT))) == e.Length;
        }
    }
}
