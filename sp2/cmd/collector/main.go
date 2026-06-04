package main

import (
	"log"
	"net"
	"net/http"
	"netflow-collector/internal/api"
	"netflow-collector/internal/netflow"
	"netflow-collector/internal/store"
)

func main() {
	tmplMgr := netflow.NewTemplateManager()
	dataStore := store.NewStore(tmplMgr)
	hub := api.NewHub()
	apiHandler := api.NewAPI(dataStore, tmplMgr, hub)
	apiHandler.RegisterRoutes()

	fs := http.FileServer(http.Dir("./dist"))
	http.Handle("/", fs)

	go func() {
		log.Println("HTTP server listening on :8080")
		if err := http.ListenAndServe(":8080", nil); err != nil {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	udpAddr, err := net.ResolveUDPAddr("udp", ":2055")
	if err != nil {
		log.Fatalf("Failed to resolve UDP address: %v", err)
	}

	conn, err := net.ListenUDP("udp", udpAddr)
	if err != nil {
		log.Fatalf("Failed to listen on UDP :2055: %v", err)
	}
	defer conn.Close()

	log.Println("NetFlow v9 collector listening on UDP :2055")

	buf := make([]byte, 65535)
	for {
		n, addr, err := conn.ReadFromUDP(buf)
		if err != nil {
			log.Printf("UDP read error: %v", err)
			continue
		}

		data := make([]byte, n)
		copy(data, buf[:n])

		sourceAddr := addr.IP.String()

		packet, err := netflow.DecodePacket(data, sourceAddr)
		if err != nil {
			log.Printf("Failed to decode packet from %s: %v", sourceAddr, err)
			continue
		}

		dataStore.RecordPacket(packet.Header.SourceID, sourceAddr)

		for _, ts := range packet.TemplateSets {
			for _, tr := range ts.Templates {
				result := tmplMgr.AddOrUpdateTemplate(packet.Header.SourceID, tr)
				switch {
				case result.IsNew():
					dataStore.RecordTemplate(packet.Header.SourceID)
					hub.BroadcastTemplateUpdate(packet.Header.SourceID, tr.TemplateID)
					log.Printf("Template %d registered for observer %d from %s", tr.TemplateID, packet.Header.SourceID, sourceAddr)
				case result.IsRefresh():
					cleared := dataStore.ClearFlowsByTemplate(packet.Header.SourceID, tr.TemplateID)
					dataStore.RecordTemplate(packet.Header.SourceID)
					hub.BroadcastTemplateUpdate(packet.Header.SourceID, tr.TemplateID)
					log.Printf("Template %d refreshed for observer %d from %s (cleared %d old flow records)", tr.TemplateID, packet.Header.SourceID, sourceAddr, cleared)
				case result.IsRejected():
					log.Printf("WARNING: Template %d rejected for observer %d from %s: %s", tr.TemplateID, packet.Header.SourceID, sourceAddr, result.RejectReason)
					hub.BroadcastTemplateWarning(packet.Header.SourceID, tr.TemplateID, result.RejectReason)
				}
			}
		}

		for _, ds := range packet.DataSets {
			templateID := ds.FlowSetHeader.FlowSetID
			template := tmplMgr.GetTemplate(packet.Header.SourceID, templateID)
			if template == nil {
				log.Printf("Unknown template %d for observer %d, skipping data flow set", templateID, packet.Header.SourceID)
				continue
			}

			for _, recordData := range ds.Records {
				tmplRecord := netflow.TemplateRecord{
					TemplateID: template.TemplateID,
					FieldCount: template.FieldCount,
				}
				for _, f := range template.Fields {
					tmplRecord.Fields = append(tmplRecord.Fields, netflow.FieldSpecifier{
						Type:             f.Type,
						Length:           f.Length,
						IsEnterprise:     f.IsEnterprise,
						EnterpriseNumber: f.EnterpriseNumber,
					})
				}

				records, err := netflow.DecodeDataRecords(recordData, &tmplRecord)
				if err != nil {
					log.Printf("Failed to decode data records: %v", err)
					continue
				}

				for _, rec := range records {
					dataStore.AddFlow(packet.Header.SourceID, templateID, rec)
					hub.BroadcastFlowRecord(packet.Header.SourceID, templateID, rec)
				}
			}
		}

		hub.BroadcastStatsUpdate(dataStore.GetStats())
	}
}
