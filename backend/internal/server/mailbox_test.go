package server

import "testing"

func TestMailbox_CoalescesSameKey(t *testing.T) {
	t.Parallel()
	m := newMailbox()
	m.Put("pair:BTC/USDT", 1, "v1")
	m.Put("pair:BTC/USDT", 2, "v2")
	m.Put("pair:BTC/USDT", 3, "v3")

	got := m.Drain()
	if len(got) != 1 || got[0].msg != "v3" || got[0].seq != 3 {
		t.Fatalf("最新の1件だけが残るはず: %+v", got)
	}
	if again := m.Drain(); again != nil {
		t.Fatalf("取り出し後は空: %+v", again)
	}
}

func TestMailbox_KeepsInsertionOrderAcrossKeys(t *testing.T) {
	t.Parallel()
	m := newMailbox()
	m.Put("a", 1, "a1")
	m.Put("b", 2, "b1")
	m.Put("a", 3, "a2") // 置き換えても a の位置は先頭のまま

	got := m.Drain()
	if len(got) != 2 || got[0].msg != "a2" || got[1].msg != "b1" {
		t.Fatalf("got=%+v", got)
	}
}

func TestMailbox_SignalsOnce(t *testing.T) {
	t.Parallel()
	m := newMailbox()
	m.Put("a", 1, "x")
	m.Put("b", 2, "y")

	select {
	case <-m.Signal():
	default:
		t.Fatal("Put 後は通知があるはず")
	}
	select {
	case <-m.Signal():
		t.Fatal("通知は1回にまとめられるはず")
	default:
	}
}

func TestMailbox_IsBoundedByKeyCount(t *testing.T) {
	t.Parallel()
	m := newMailbox()
	for i := 0; i < 100000; i++ {
		m.Put("pair:BTC/USDT", uint64(i), i)
		m.Put("pair:ETH/USDT", uint64(i), i)
	}
	if got := m.Drain(); len(got) != 2 {
		t.Fatalf("キー数を超えて溜まらないはず: %d", len(got))
	}
}
