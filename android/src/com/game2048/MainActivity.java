package com.game2048;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

/**
 * Thin native shell: the whole game lives in assets/index.html and runs inside this WebView.
 * The page reaches back through the "Native" bridge to tint the system bars and to share a score.
 */
public class MainActivity extends Activity {

    private static final String PAGE = "file:///android_asset/index.html";
    private static final String EXTRA_GO = "go";

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        setBars(getResources().getColor(R.color.gradient_top),
                getResources().getColor(R.color.gradient_bottom));

        web = new WebView(this);
        // Transparent until the page paints, so the splash gradient stays visible instead of a white flash.
        web.setBackgroundColor(Color.TRANSPARENT);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        // The page owns all gestures; long-press text selection would fight with swiping.
        web.setLongClickable(false);
        web.setHapticFeedbackEnabled(false);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // saved game, best scores, stats and settings live here
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSupportZoom(false);
        s.setUseWideViewPort(false);
        s.setLoadWithOverviewMode(false);
        s.setTextZoom(100);                    // ignore the system font-size setting; the board is sized in vw
        s.setMediaPlaybackRequiresUserGesture(false);   // let the tap sounds play

        web.addJavascriptInterface(new Bridge(), "Native");
        web.setWebViewClient(new WebViewClient() {
            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // The bridge is only ever exposed to our own bundled page.
                return url == null || !url.startsWith("file:///android_asset/");
            }
        });

        web.loadUrl(pageFor(getIntent()));
        setContentView(web);

        publishShortcuts();
    }

    private String pageFor(Intent intent) {
        String go = intent == null ? null : intent.getStringExtra(EXTRA_GO);
        return go == null ? PAGE : PAGE + "?go=" + go;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String go = intent == null ? null : intent.getStringExtra(EXTRA_GO);
        if (go != null && web != null) {
            web.evaluateJavascript("window.__shortcut && window.__shortcut('" + go + "')", null);
        }
    }

    /** Tint the system bars; the page calls this again whenever the player switches theme. */
    private void setBars(int top, int bottom) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return;
        getWindow().setStatusBarColor(top);
        getWindow().setNavigationBarColor(bottom);
        if (Build.VERSION.SDK_INT >= 26) {
            // SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR — dark icons on the light bottom of the gradient.
            View decor = getWindow().getDecorView();
            decor.setSystemUiVisibility(decor.getSystemUiVisibility() | 0x10);
        }
    }

    /**
     * Launcher shortcuts (long-press the icon). ShortcutManager is API 25, newer than the
     * android.jar this project builds against, so it is driven by reflection.
     */
    private void publishShortcuts() {
        if (Build.VERSION.SDK_INT < 25) return;
        try {
            Class<?> managerClass = Class.forName("android.content.pm.ShortcutManager");
            Object manager = getSystemService(managerClass);
            if (manager == null) return;
            List<Object> shortcuts = new ArrayList<Object>();
            shortcuts.add(shortcut("new", getString(R.string.shortcut_new), "new"));
            shortcuts.add(shortcut("daily", getString(R.string.shortcut_daily), "daily"));
            Method setDynamic = managerClass.getMethod("setDynamicShortcuts", List.class);
            setDynamic.invoke(manager, shortcuts);
        } catch (Throwable ignored) {
            // Older or unusual launchers simply get no shortcuts.
        }
    }

    private Object shortcut(String id, String label, String go) throws Exception {
        Class<?> builderClass = Class.forName("android.content.pm.ShortcutInfo$Builder");
        Object builder = builderClass.getConstructor(Context.class, String.class).newInstance(this, id);
        builderClass.getMethod("setShortLabel", CharSequence.class).invoke(builder, label);
        builderClass.getMethod("setLongLabel", CharSequence.class).invoke(builder, label);
        builderClass.getMethod("setIcon", Icon.class)
                .invoke(builder, Icon.createWithResource(this, R.mipmap.ic_launcher));

        Intent intent = new Intent(Intent.ACTION_MAIN, null, this, MainActivity.class);
        intent.putExtra(EXTRA_GO, go);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        builderClass.getMethod("setIntent", Intent.class).invoke(builder, intent);

        return builderClass.getMethod("build").invoke(builder);
    }

    /**
     * Back closes an open sheet, then returns to the menu; only then does it leave the app.
     * The page answers "true" when it handled the press itself.
     */
    @Override
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        // An anonymous class, not a lambda: dx cannot dex invokedynamic.
        web.evaluateJavascript("(window.__onBack && window.__onBack()) === true",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (!"true".equals(value)) finish();
                    }
                });
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /** Exposed to the page as window.Native. */
    private class Bridge {
        @JavascriptInterface
        public void setBars(final String top, final String bottom) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        MainActivity.this.setBars(Color.parseColor(top), Color.parseColor(bottom));
                    } catch (IllegalArgumentException ignored) {
                    }
                }
            });
        }

        @JavascriptInterface
        public void share(final String text) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("text/plain");
                    send.putExtra(Intent.EXTRA_TEXT, text);
                    startActivity(Intent.createChooser(send, getString(R.string.share_title)));
                }
            });
        }
    }
}
