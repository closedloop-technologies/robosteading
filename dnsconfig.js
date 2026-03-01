var REG_NONE = NewRegistrar("none");
var CF = NewDnsProvider("cloudflare");

D("robosteading.com", REG_NONE, DnsProvider(CF),
    A("@", "185.199.108.153"),
    A("@", "185.199.109.153"),
    A("@", "185.199.110.153"),
    A("@", "185.199.111.153"),
    CNAME("www", "closedloop-technologies.github.io."),
    TXT("_gh-closedloop-technologies-o", "95d22fabea")
);
