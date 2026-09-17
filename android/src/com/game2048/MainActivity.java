package com.game2048;

import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Thin native shell: the whole game lives in assets/index.html and runs inside this WebView.
 */
public class MainActivity extends Activity {

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        applySystemBarStyle();

        web = new WebView(this);
        web.setBackgroundColor(getResources().getColor(R.color.gradient_top));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        // The page owns all gestures; long-press text selection would fight with swiping.
        web.setLongClickable(false);
        web.setHapticFeedbackEnabled(false);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // the game stores its state, best score and settings here
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSupportZoom(false);
        s.setUseWideViewPort(false);
        s.setLoadWithOverviewMode(false);
        s.setTextZoom(100);                    // ignore the system font-size setting; the board is sized in vw
        s.setMediaPlaybackRequiresUserGesture(false);   // let the tap sounds play

        web.setWebViewClient(new WebViewClient());
        web.loadUrl("file:///android_asset/index.html");
        setContentView(web);
    }

    /** Tint the system bars to the two ends of the page gradient. */
    private void applySystemBarStyle() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return;
        getWindow().setStatusBarColor(getResources().getColor(R.color.gradient_top));
        getWindow().setNavigationBarColor(getResources().getColor(R.color.gradient_bottom));
        if (Build.VERSION.SDK_INT >= 26) {
            // SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR — dark icons on the light bottom of the gradient.
            View decor = getWindow().getDecorView();
            decor.setSystemUiVisibility(decor.getSystemUiVisibility() | 0x10);
        }
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
}
